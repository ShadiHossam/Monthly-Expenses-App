import time
import base64
import json
from collections import deque
from typing import Optional
import httpx
from app.config import settings

ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"

_ANTHROPIC_MODEL_DEF = {
    "provider": "anthropic",
    "model": ANTHROPIC_MODEL,
    "api_base": "https://api.anthropic.com",
    "api_key_env": "anthropic_api_key",
    "rpm_limit": 50,
    "vision": True,
}


class AIClient:
    def __init__(self):
        self._rate_limited_until: dict[str, float] = {}
        self._call_times: dict[str, deque] = {}

    def _key(self, model: dict) -> str:
        return model["model"]

    def _is_available(self, model: dict) -> bool:
        key = self._key(model)
        now = time.time()
        if self._rate_limited_until.get(key, 0) > now:
            return False
        window = self._call_times.setdefault(key, deque())
        cutoff = now - 60
        while window and window[0] < cutoff:
            window.popleft()
        return len(window) < model["rpm_limit"]

    def _record_call(self, model: dict):
        self._call_times.setdefault(self._key(model), deque()).append(time.time())

    def _mark_rate_limited(self, model: dict, retry_after: int = 60):
        self._rate_limited_until[self._key(model)] = time.time() + retry_after

    def _resolve_api_key(self, model: dict, user_keys: dict | None) -> str:
        provider = model["provider"]
        if user_keys:
            user_key = user_keys.get(provider)
            if user_key:
                return user_key
        return getattr(settings, model["api_key_env"], "")

    def _build_candidates(self, vision: bool, user_keys: dict | None, provider: str) -> list[dict]:
        base = [m for m in settings.ai_models if not vision or m["vision"]]

        # Add Anthropic if the user has a key
        if user_keys and user_keys.get("anthropic"):
            if not vision or _ANTHROPIC_MODEL_DEF["vision"]:
                base = [_ANTHROPIC_MODEL_DEF] + base

        if provider == "auto":
            return base

        filtered = [m for m in base if m["provider"] == provider]
        # Fall back to all candidates if the preferred provider has no available key
        return filtered if filtered else base

    async def complete(
        self,
        messages: list,
        vision: bool = False,
        temperature: float = 0.1,
        json_mode: bool = False,
    ) -> str:
        from app.services.ai.context import user_keys_var, user_provider_var
        user_keys = user_keys_var.get()
        provider = user_provider_var.get()

        candidates = self._build_candidates(vision, user_keys, provider)

        last_error = None
        for model in candidates:
            if not self._is_available(model):
                continue
            api_key = self._resolve_api_key(model, user_keys)
            if not api_key or "your" in api_key.lower():
                continue
            try:
                self._record_call(model)
                result = await self._call_model(model, messages, temperature, json_mode, api_key)
                return result
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("retry-after", "60"))
                    self._mark_rate_limited(model, retry_after)
                    last_error = e
                    continue
                raise
            except Exception as e:
                last_error = e
                continue

        raise RuntimeError(f"All AI models exhausted or rate-limited. Last error: {last_error}")

    async def _call_model(
        self,
        model: dict,
        messages: list,
        temperature: float,
        json_mode: bool,
        api_key: str,
    ) -> str:
        if model["provider"] == "anthropic":
            return await self._call_anthropic(model, messages, temperature, api_key)
        return await self._call_openai_compat(model, messages, temperature, json_mode, api_key)

    async def _call_openai_compat(
        self,
        model: dict,
        messages: list,
        temperature: float,
        json_mode: bool,
        api_key: str,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if model["provider"] == "openrouter":
            headers["HTTP-Referer"] = "expense-tracker-app"
            headers["X-Title"] = "Expense Tracker"

        body: dict = {
            "model": model["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 4096,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{model['api_base']}/chat/completions",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _call_anthropic(
        self,
        model: dict,
        messages: list,
        temperature: float,
        api_key: str,
    ) -> str:
        # Convert OpenAI image_url blocks to Anthropic image blocks
        converted = []
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, list):
                new_content = []
                for block in content:
                    if block.get("type") == "image_url":
                        url = block["image_url"]["url"]
                        header, data = url.split(",", 1)
                        media_type = header.split(":")[1].split(";")[0]
                        new_content.append({
                            "type": "image",
                            "source": {"type": "base64", "media_type": media_type, "data": data},
                        })
                    else:
                        new_content.append(block)
                converted.append({**msg, "content": new_content})
            else:
                converted.append(msg)

        body = {
            "model": model["model"],
            "messages": converted,
            "temperature": temperature,
            "max_tokens": 4096,
        }

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]

    async def complete_json(self, messages: list, vision: bool = False) -> dict:
        raw = await self.complete(messages, vision=vision, json_mode=True)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            import re
            cleaned = re.sub(r"```(?:json)?\n?", "", raw).strip().rstrip("`")
            return json.loads(cleaned)

    @staticmethod
    def image_to_message(image_path: str) -> dict:
        with open(image_path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        ext = image_path.rsplit(".", 1)[-1].lower()
        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{data}"},
        }


# Singleton shared across requests
ai_client = AIClient()
