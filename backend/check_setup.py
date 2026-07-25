"""
Pre-flight check — run this BEFORE `uvicorn app.main:app --reload`.

Usage (must run from the `backend/` folder):
    python check_setup.py
"""
import sys


def main():
    print("1. Checking .env is loadable...")
    try:
        from app.config import get_settings
        settings = get_settings()
        print("   OK — SUPABASE_URL:", settings.SUPABASE_URL)
    except Exception as e:
        print("   FAILED:", e)
        sys.exit(1)

    print("2. Checking Supabase connection (profiles table)...")
    try:
        from app.config import get_supabase_admin
        admin = get_supabase_admin()
        res = admin.table("profiles").select("id").limit(1).execute()
        print(f"   OK — profiles table reachable ({len(res.data)} row(s) returned)")
    except Exception as e:
        print("   FAILED:", e)
        print("   -> Did you run supabase/schema.sql in the Supabase SQL Editor?")
        sys.exit(1)

    print("3. Checking SUPABASE_SERVICE_ROLE_KEY actually bypasses RLS...")
    try:
        probe_id = "00000000-0000-0000-0000-000000000000"
        admin.table("profiles").upsert({
            "id": probe_id,
            "full_name": "check_setup probe",
            "email": "probe@check-setup.local",
            "phone": None,
            "role": "individual",
        }).execute()
        admin.table("profiles").delete().eq("id", probe_id).execute()
        print("   OK — service_role key bypasses RLS correctly")
    except Exception as e:
        print("   FAILED:", e)
        print(
            "   -> SUPABASE_SERVICE_ROLE_KEY in .env is wrong (likely the anon key was "
            "pasted here by mistake). Get the real 'service_role' / 'secret' key from "
            "Supabase Dashboard -> Settings -> API and it must be DIFFERENT from "
            "SUPABASE_ANON_KEY."
        )
        sys.exit(1)

    print("\nAll checks passed. Safe to run: uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()