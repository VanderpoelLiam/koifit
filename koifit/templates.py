"""
Shared Jinja2 environment.
"""

from jinja2 import Environment, FileSystemLoader


def format_rest_time(minutes: float) -> str:
    """Format rest time: 3.0 → '3 min', 1.5 → '1 min 30 s'."""
    mins = int(minutes)
    secs = int((minutes - mins) * 60)

    if secs == 0:
        return f"{mins} min"
    elif mins == 0:
        return f"{secs} s"
    else:
        return f"{mins} min {secs} s"


def format_weight(weight: float) -> str:
    """Format weight: 20.0 → '20', 20.25 → '20.25'."""
    if weight == int(weight):
        return str(int(weight))
    return str(weight)


templates = Environment(loader=FileSystemLoader("templates"), autoescape=True)
templates.filters["rest_time"] = format_rest_time
templates.filters["weight"] = format_weight

__all__ = ["templates"]
