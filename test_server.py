#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fastmcp>=2.10"]
# ///
"""Tiny MCP server used to smoke-test mcpx."""
from fastmcp import FastMCP

mcp = FastMCP("test")


@mcp.tool
def add(a: int, b: int, note: str = "") -> str:
    """Add two integers."""
    return f"{a + b} {note}".strip()


@mcp.tool
def shout(text: str) -> str:
    """Uppercase some text."""
    return text.upper()


@mcp.tool
def filter_items(tags: list[str], strict: bool = False, dry_run: bool = False) -> str:
    """Exercise array and boolean params."""
    return f"tags={tags} strict={strict} dry_run={dry_run}"


@mcp.prompt
def greet(name: str) -> str:
    """Say hi to someone."""
    return f"Please greet {name} warmly."


@mcp.resource("data://motd")
def motd() -> str:
    """Message of the day."""
    return "hello from the test server"


@mcp.resource("data://user/{user_id}")
def user(user_id: str) -> str:
    """Look up a user."""
    return f"user record for {user_id}"



@mcp.tool(name="inferences-sandbox___generate_weekly_personal_learning_digest")
def digest(user_handle: str) -> str:
    """Generate a weekly personal learning digest summarizing recent activity, recommended content, and progress toward goals."""
    return f"digest for {user_handle}"


if __name__ == "__main__":
    mcp.run()
