"""
Central loguru configuration for the Hebrew Grocery Categorizer.

Import and call setup_logging() once at app startup (FastAPI lifespan or __main__).
Writes structured, colorized logs to stdout — readable by Koyeb and local dev alike.
"""

import sys

from loguru import logger


def setup_logging(level: str = "DEBUG") -> None:
    """
    Configure loguru: remove default handler, add a clean stdout handler.

    Format:
        2026-04-07 12:34:56.789 | DEBUG | core.categorizer:categorize:42 | message

    Args:
        level: Minimum log level (DEBUG / INFO / WARNING / ERROR).
    """
    logger.remove()  # Remove default stderr handler
    logger.add(
        sys.stdout,
        level=level,
        colorize=True,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        ),
        backtrace=True,
        diagnose=True,
    )
    logger.info("Logging initialised (level={})", level)
