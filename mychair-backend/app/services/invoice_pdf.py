import logging
import re
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.models.bill import Bill

logger = logging.getLogger("invoice_pdf")


def _safe_filename(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-") or "invoice"


class InvoicePDFService:
    """Generates publicly served invoice PDFs for outbound customer messages."""

    def __init__(self) -> None:
        self.asset_root = Path(settings.PUBLIC_ASSET_DIR)
        self.invoice_dir = self.asset_root / "invoices"

    def _public_url_for(self, filename: str) -> str:
        base_url = settings.BACKEND_PUBLIC_URL.rstrip("/")
        return f"{base_url}/static/invoices/{filename}"

    async def ensure_bill_pdf_url(self, bill: Bill) -> Optional[str]:
        filename = f"{_safe_filename(bill.bill_number)}-{str(bill.id)}.pdf"
        path = self.invoice_dir / filename
        try:
            self.invoice_dir.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                self._write_pdf(path, bill)
            return self._public_url_for(filename)
        except Exception as exc:
            logger.error("Invoice PDF generation failed for bill %s: %s", bill.id, exc)
            return None

    def _write_pdf(self, path: Path, bill: Bill) -> None:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(
            str(path),
            pagesize=A4,
            rightMargin=16 * mm,
            leftMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
        )

        story = [
            Paragraph(bill.salon_name or "Salon", styles["Title"]),
            Paragraph(f"Invoice: {bill.bill_number}", styles["Normal"]),
            Paragraph(f"Customer: {bill.customer_name or 'Customer'}", styles["Normal"]),
            Paragraph(f"Phone: {bill.customer_phone or '-'}", styles["Normal"]),
            Spacer(1, 8 * mm),
        ]

        rows = [["Item", "Qty", "Rate", "Tax", "Total"]]
        for item in bill.items:
            rows.append(
                [
                    item.name,
                    str(item.quantity),
                    f"Rs. {item.unit_price:.2f}",
                    f"Rs. {item.tax_amount:.2f}",
                    f"Rs. {item.line_total:.2f}",
                ]
            )

        table = Table(rows, colWidths=[72 * mm, 16 * mm, 28 * mm, 28 * mm, 28 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.extend(
            [
                table,
                Spacer(1, 8 * mm),
                Paragraph(f"Subtotal: Rs. {bill.subtotal:.2f}", styles["Normal"]),
                Paragraph(f"Tax: Rs. {bill.tax_amount:.2f}", styles["Normal"]),
                Paragraph(f"Total: Rs. {bill.total_amount:.2f}", styles["Heading3"]),
                Paragraph(f"Paid: Rs. {bill.paid_amount:.2f}", styles["Normal"]),
                Paragraph(f"Remaining: Rs. {bill.remaining_amount:.2f}", styles["Normal"]),
            ]
        )
        doc.build(story)
