"""FastAPI app entrypoint - wires up routers and startup/shutdown hooks."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.admin_routes import router as admin_router
from app.auth_routes import router as auth_router
from app.db import close_pool, init_pool
from app.process_routes import router as process_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    yield
    close_pool()


app = FastAPI(title="Process Studio API", version="1.0.0", lifespan=lifespan)

# Adjust allow_origins to your actual frontend origin(s) before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(process_router)
app.include_router(admin_router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
