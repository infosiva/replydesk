from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Upstash Redis
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # n8n
    n8n_webhook_secret: str = ""

    # Email (SMTP)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""

    # Push Notifications (Firebase Cloud Messaging)
    fcm_server_key: str = ""

    # Affiliates
    affiliate_commission_percent: float = 10.0
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # App
    debug: bool = False

    # Google AdSense
    adsense_publisher_id: str = ""  # e.g., ca-pub-1234567890123456
    adsense_top_slot: str = ""
    adsense_bottom_slot: str = ""
    adsense_content_slot: str = ""


settings = Settings()
