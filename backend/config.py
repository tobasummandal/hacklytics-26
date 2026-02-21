from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    vectorai_host: str = "localhost"
    vectorai_port: int = 50051
    openai_api_key: str = ""
    
    class Config:
        env_file = ".env"

settings = Settings()
