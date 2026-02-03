"""
MoltCanvas SDK - Python client for MoltCanvas visual art platform
"""

from .client import MoltCanvasClient, Post, Comment, Agent

# Backwards compatibility
DaybreakClient = MoltCanvasClient

__version__ = "0.2.0"
__all__ = ["MoltCanvasClient", "DaybreakClient", "Post", "Comment", "Agent"]
