"""
Shared Jinja2 environment.
"""
from jinja2 import Environment, FileSystemLoader

templates = Environment(loader=FileSystemLoader("views"), autoescape=True)

__all__ = ["templates"]

