from unittest.mock import MagicMock, patch

import pytest

from app.services.agent import run_agent


def _make_text_response(text):
    """Create a mock Claude response with a text block."""
    block = MagicMock()
    block.type = "text"
    block.text = text

    response = MagicMock()
    response.content = [block]
    response.stop_reason = "end_turn"
    return response


def _make_tool_use_response(tool_name, tool_input, tool_id="tool_1"):
    """Create a mock Claude response with a tool_use block."""
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.name = tool_name
    tool_block.input = tool_input
    tool_block.id = tool_id

    response = MagicMock()
    response.content = [tool_block]
    response.stop_reason = "tool_use"
    return response


@pytest.mark.asyncio
@patch("app.services.agent.anthropic.Anthropic")
async def test_run_agent_simple_response(mock_anthropic_cls):
    client = MagicMock()
    client.messages.create.return_value = _make_text_response("AAPL is trading at $150.")
    mock_anthropic_cls.return_value = client

    result = await run_agent("What is AAPL price?")

    assert "AAPL" in result["response"]
    assert len(result["messages"]) == 2  # user + assistant


@pytest.mark.asyncio
@patch("app.services.agent.execute_tool")
@patch("app.services.agent.anthropic.Anthropic")
async def test_run_agent_with_tool_use(mock_anthropic_cls, mock_execute_tool):
    client = MagicMock()

    # First call returns tool_use, second returns text
    client.messages.create.side_effect = [
        _make_tool_use_response("get_stock_price", {"symbol": "AAPL"}),
        _make_text_response("Apple is currently trading at $150."),
    ]
    mock_anthropic_cls.return_value = client

    mock_execute_tool.return_value = {
        "symbol": "AAPL",
        "price": 150.0,
        "currency": "USD",
    }

    result = await run_agent("Tell me about AAPL")

    assert "150" in result["response"]
    mock_execute_tool.assert_called_once_with("get_stock_price", {"symbol": "AAPL"})


@pytest.mark.asyncio
@patch("app.services.agent.anthropic.Anthropic")
async def test_run_agent_preserves_history(mock_anthropic_cls):
    client = MagicMock()
    client.messages.create.return_value = _make_text_response("Here's the comparison.")
    mock_anthropic_cls.return_value = client

    history = [
        {"role": "user", "content": "Tell me about AAPL"},
        {"role": "assistant", "content": [{"type": "text", "text": "AAPL is at $150."}]},
    ]

    result = await run_agent("Compare with MSFT", conversation_history=history)

    # History should have original 2 + new user + new assistant = 4
    assert len(result["messages"]) == 4
