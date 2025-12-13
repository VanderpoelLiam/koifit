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


def format_warmup_sets(warmup_sets: str) -> str:
    """Format warmup sets: '2-3' → 'Warmup: 2-3 sets', '1' → 'Warmup: 1 set'."""
    if "-" in warmup_sets:
        # Range like "2-3"
        return f"Warmup: {warmup_sets} sets"
    else:
        # Single number
        try:
            num = int(warmup_sets)
            if num == 1:
                return "Warmup: 1 set"
            else:
                return f"Warmup: {warmup_sets} sets"
        except ValueError:
            # Fallback for any other format
            return f"Warmup: {warmup_sets} sets"


templates = Environment(loader=FileSystemLoader("templates"), autoescape=True)
templates.filters["rest_time"] = format_rest_time
templates.filters["weight"] = format_weight
templates.filters["warmup_sets"] = format_warmup_sets

__all__ = ["templates"]
