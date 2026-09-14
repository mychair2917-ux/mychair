import logging
import re
from pathlib import Path
from typing import Any, Optional

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
        return await self.ensure_invoice_pdf_url(bill)

    async def ensure_invoice_pdf_url(self, invoice_or_bill: Any) -> Optional[str]:
        inv_number = (
            getattr(invoice_or_bill, "invoice_number", None)
            or getattr(invoice_or_bill, "bill_number", None)
            or "INV"
        )
        inv_id = str(getattr(invoice_or_bill, "id", "doc"))
        filename = f"{_safe_filename(inv_number)}-{inv_id}.pdf"
        path = self.invoice_dir / filename
        try:
            self.invoice_dir.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                self._write_pdf(path, invoice_or_bill)
            return self._public_url_for(filename)
        except Exception as exc:
            logger.error("Invoice PDF generation failed for doc %s: %s", inv_id, exc)
            return None

    def _write_pdf(self, path: Path, bill: Any) -> None:
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

        salon_name = getattr(bill, "salon_name", None) or "Salon"
        inv_num = getattr(bill, "invoice_number", None) or getattr(bill, "bill_number", "INV")
        customer_name = getattr(bill, "customer_name", None) or "Customer"
        customer_phone = getattr(bill, "customer_phone", None) or "-"

        story = [
            Paragraph(salon_name, styles["Title"]),
            Paragraph(f"Invoice: {inv_num}", styles["Normal"]),
            Paragraph(f"Customer: {customer_name}", styles["Normal"]),
            Paragraph(f"Phone: {customer_phone}", styles["Normal"]),
            Spacer(1, 8 * mm),
        ]

        rows = [["Item", "Qty", "Rate", "Tax", "Total"]]
        for item in getattr(bill, "items", []):
            tax_amt = getattr(item, "tax_amount", 0.0)
            line_tot = getattr(item, "total", None) or getattr(item, "line_total", None)
            if line_tot is None:
                discount = getattr(item, "discount", 0.0)
                line_tot = (item.unit_price * item.quantity - discount) + tax_amt
            rows.append(
                [
                    item.name,
                    str(item.quantity),
                    f"Rs. {item.unit_price:.2f}",
                    f"Rs. {tax_amt:.2f}",
                    f"Rs. {line_tot:.2f}",
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
                Paragraph(f"Subtotal: Rs. {getattr(bill, 'subtotal', 0.0):.2f}", styles["Normal"]),
                Paragraph(f"Tax: Rs. {getattr(bill, 'tax_amount', 0.0):.2f}", styles["Normal"]),
                Paragraph(f"Total: Rs. {getattr(bill, 'total_amount', 0.0):.2f}", styles["Heading3"]),
                Paragraph(f"Paid: Rs. {getattr(bill, 'paid_amount', 0.0):.2f}", styles["Normal"]),
                Paragraph(f"Remaining: Rs. {getattr(bill, 'remaining_amount', 0.0):.2f}", styles["Normal"]),
                Paragraph(f"Payment status: {getattr(bill, 'payment_status', 'PENDING')}", styles["Normal"]),
            ]
        )

        history = list(getattr(bill, "payment_history", None) or [])
        if history:
            story.append(Spacer(1, 6 * mm))
            story.append(Paragraph("Payment History", styles["Heading3"]))
            history_rows = [["#", "Amount", "Method", "Status", "Remaining", "Details"]]
            for entry in history:
                history_rows.append(
                    [
                        str(entry.installment_number),
                        f"Rs. {entry.amount:.2f}",
                        entry.payment_method or getattr(bill, "payment_method", None) or "-",
                        entry.status_after,
                        f"Rs. {entry.remaining_amount_after:.2f}",
                        entry.note or "-",
                    ]
                )
            history_table = Table(
                history_rows,
                colWidths=[12 * mm, 24 * mm, 22 * mm, 28 * mm, 26 * mm, 60 * mm],
            )
            history_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(history_table)

        doc.build(story)
