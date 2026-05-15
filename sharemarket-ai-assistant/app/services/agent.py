"""AI Agent using Groq with tool use."""

import asyncio
import json
import logging

from groq import Groq

from app.config import settings
from app.tools.definitions import TOOLS, execute_tool

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a knowledgeable stock market analyst assistant for StockPulse. "
    "You help users analyze stocks across US and Indian markets, understand market trends, "
    "and make informed investment decisions.\n\n"
    "You have access to powerful tools for market analysis:\n\n"
    "**Market Data Tools:**\n"
    "- get_stock_price: Current price and trading data (US stocks: AAPL, TSLA; India NSE: RELIANCE.NS, TCS.NS)\n"
    "- get_stock_history: Historical OHLCV data\n"
    "- get_company_info: Company fundamentals and metrics\n"
    "- get_financial_statements: Income statement, balance sheet, cash flow\n"
    "- get_analyst_recommendations: Analyst ratings\n"
    "- get_stock_news: Recent news articles\n\n"
    "**India Market (NSE/BSE):**\n"
    "- get_india_stock: Indian stocks — auto-adds .NS suffix. Use for Reliance, TCS, Infosys, HDFC, etc.\n"
    "- For Nifty50/Sensex stocks, always use get_india_stock\n\n"
    "**Market Overview Tools:**\n"
    "- get_market_movers: Top gainers and losers today (US or India)\n"
    "- get_sector_performance: All sectors up/down today — like a heatmap\n"
    "- get_earnings_calendar: Upcoming earnings dates and EPS estimates\n\n"
    "**Advanced Analysis Tools:**\n"
    "- analyze_chart: Technical analysis with trends, support/resistance, "
    "patterns, and indicators (RSI, MACD, Bollinger Bands)\n"
    "- compare_stocks: Side-by-side comparison of 2-5 stocks\n"
    "- analyze_portfolio: Comprehensive analysis of user's watchlist\n"
    "- get_watchlist_insights: Quick overview of watched stocks\n\n"
    "**How to help users:**\n"
    "1. For Indian stocks (Reliance, TCS, Nifty etc.) → use get_india_stock\n"
    "2. 'What's moving today?' / 'Market movers' → use get_market_movers\n"
    "3. 'How are sectors doing?' / 'Market heatmap' → use get_sector_performance\n"
    "4. 'When does X report earnings?' → use get_earnings_calendar\n"
    "5. Fetch relevant data using tools before providing analysis\n"
    "6. Use analyze_chart for technical analysis, trends, or patterns\n"
    "7. Present key metrics with clear interpretation\n\n"
    "**Important guidelines:**\n"
    "- Always use tools to get current data rather than training data\n"
    "- Clearly state that you provide analysis, not financial advice\n"
    "- Present both bullish and bearish perspectives when relevant\n"
    "- Use specific numbers and data points in your analysis\n"
    "- If a ticker is invalid or data unavailable, let the user know\n"
    "- For personalized insights, the tools use the user's data automatically"
)

MAX_TOOL_ROUNDS = 10
MAX_RETRIES = 2  # Retry on tool calling failures


def _convert_tools_to_groq_format() -> list:
    """Convert our tool definitions to Groq/OpenAI function format."""
    groq_tools = []
    for tool in TOOLS:
        groq_tools.append({
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"],
            }
        })
    return groq_tools


def _get_groq_client():
    """Initialize and return Groq client."""
    return Groq(api_key=settings.groq_api_key)


async def run_agent(
    user_message: str,
    conversation_history: list | None = None,
    user_id: str | None = None,
) -> dict:
    """Run the agentic tool-use loop with Groq.

    Args:
        user_message: The user's message
        conversation_history: Previous conversation messages
        user_id: Optional user ID for personalized tools (portfolio, watchlist)

    Returns a dict with:
        - response: the final text response
        - messages: the full conversation history (for persistence)
    """
    client = _get_groq_client()
    tools = _convert_tools_to_groq_format()

    # Build messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if conversation_history:
        for msg in conversation_history:
            if isinstance(msg, dict) and "role" in msg:
                role = msg.get("role")
                content = msg.get("content", "")
                if isinstance(content, str):
                    messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    # Track messages for persistence
    stored_messages = list(conversation_history) if conversation_history else []
    stored_messages.append({"role": "user", "content": user_message})

    for _ in range(MAX_TOOL_ROUNDS):
        # Retry loop for handling intermittent tool calling failures
        last_error = None
        for retry in range(MAX_RETRIES + 1):
            try:
                response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=settings.groq_model,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    max_tokens=4096,
                )
                last_error = None
                break  # Success, exit retry loop
            except Exception as e:
                last_error = e
                error_str = str(e)
                # Retry on tool_use_failed errors (intermittent GROQ issue)
                if "tool_use_failed" in error_str and retry < MAX_RETRIES:
                    logger.warning("Tool use failed, retrying (%d/%d): %s", retry + 1, MAX_RETRIES, e)
                    await asyncio.sleep(0.5)  # Brief delay before retry
                    continue
                logger.exception("Groq API error")
                break

        if last_error:
            return {
                "response": "I had trouble processing that request. Please try rephrasing your question.",
                "messages": stored_messages,
            }

        choice = response.choices[0]
        assistant_message = choice.message

        # Check if there are tool calls
        if assistant_message.tool_calls:
            # Add assistant message with tool calls to history
            messages.append({
                "role": "assistant",
                "content": assistant_message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })

            # Execute each tool call
            for tool_call in assistant_message.tool_calls:
                func_name = tool_call.function.name
                try:
                    func_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    func_args = {}

                logger.info("Executing tool: %s(%s)", func_name, func_args)
                result = await execute_tool(func_name, func_args, user_id=user_id)

                # Add tool result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, default=str),
                })
        else:
            # No tool calls - return the response
            text_response = assistant_message.content or ""
            stored_messages.append({"role": "assistant", "content": text_response})
            return {
                "response": text_response,
                "messages": stored_messages,
            }

    # Exceeded max rounds
    return {
        "response": (
            "I've gathered a lot of data but reached the processing limit. "
            "Please try a more specific question."
        ),
        "messages": stored_messages,
    }
