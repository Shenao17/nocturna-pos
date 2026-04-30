from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Base de datos
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "Orvex#Admin2026!"
    DB_NAME: str = "nocturna_pos"

    # JWT
    SECRET_KEY: str = "dev_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas turno completo

    # App
    APP_NAME: str = "Nocturna POS"
    APP_VERSION: str = "1.0.0"
    BUILT_BY: str = "BlackLabs Development"
    DEBUG: bool = False

    # Email
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "pos@nocturna.co"

    # Stock
    LOW_STOCK_THRESHOLD: int = 5

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
