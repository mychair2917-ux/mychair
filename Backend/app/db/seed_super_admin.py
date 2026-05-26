import asyncio
import os
import sys

# Add the parent directory to sys.path so 'app' can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.db.connection import init_db
from app.models.user import User
from app.core.security import get_password_hash

async def seed():
    # Initialize the database connection
    await init_db()
    
    email = os.environ.get("SEED_SUPER_ADMIN_EMAIL", "mychar2917@gmail.com")
    password = os.environ.get("SEED_SUPER_ADMIN_PASSWORD", "Tudip@123")
    
    # Check if Super Admin already exists
    existing_admin = await User.find_one(User.email == email)
    if existing_admin:
        print(f"Super Admin with email {email} already exists.")
        return

    # Create the Super Admin user
    hashed_password = get_password_hash(password)
    
    super_admin = User(
        email=email,
        hashed_password=hashed_password,
        role="super_admin",
        status="ACTIVE",
        is_active=True,
        first_name="Super",
        last_name="Admin"
    )
    
    await super_admin.insert()
    print(f"Successfully created Super Admin user: {email}")

if __name__ == "__main__":
    asyncio.run(seed())
