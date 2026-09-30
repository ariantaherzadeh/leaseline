"""In-memory stand-in for the parts of the ElevenLabs SDK that deploy uses."""

import itertools
from types import SimpleNamespace
from typing import Any

from elevenlabs.types import AgentPlatformSettingsRequestModel, ConversationalConfig


class FakeElevenLabs:
    def __init__(self) -> None:
        self.docs: dict[str, SimpleNamespace] = {}
        self.agents: dict[str, SimpleNamespace] = {}
        self.calls: list[str] = []
        self._ids = itertools.count(1)
        self.conversational_ai = SimpleNamespace(
            knowledge_base=SimpleNamespace(
                list=self._kb_list,
                documents=SimpleNamespace(create_from_text=self._kb_create, delete=self._kb_delete),
            ),
            agents=SimpleNamespace(
                list=self._agents_list,
                get=self._agents_get,
                create=self._agents_create,
                update=self._agents_update,
            ),
        )

    # knowledge base
    def _kb_list(self, search: str = "", **_: Any) -> SimpleNamespace:
        docs = [d for d in self.docs.values() if search in d.name]
        return SimpleNamespace(documents=docs, has_more=False, next_cursor=None)

    def _kb_create(self, text: str, name: str) -> SimpleNamespace:
        self.calls.append(f"kb.create {name}")
        doc = SimpleNamespace(id=f"doc_{next(self._ids)}", name=name, text=text)
        self.docs[doc.id] = doc
        return doc

    def _kb_delete(self, documentation_id: str) -> None:
        self.calls.append(f"kb.delete {self.docs[documentation_id].name}")
        attached = {
            kb["id"]
            for a in self.agents.values()
            for kb in a.conversation_config["agent"]["prompt"]["knowledge_base"]
        }
        assert documentation_id not in attached, "deleted a doc still attached to an agent"
        del self.docs[documentation_id]

    # agents
    def _validate(self, conversation_config: dict, platform_settings: dict) -> None:
        ConversationalConfig.model_validate(conversation_config)
        AgentPlatformSettingsRequestModel.model_validate(platform_settings)
        for kb in conversation_config["agent"]["prompt"]["knowledge_base"]:
            assert kb["id"] in self.docs, f"agent references missing doc {kb['id']}"

    def _agents_list(self, search: str = "", **_: Any) -> SimpleNamespace:
        agents = [a for a in self.agents.values() if search in a.name]
        return SimpleNamespace(agents=agents, has_more=False, next_cursor=None)

    def _agents_get(self, agent_id: str) -> SimpleNamespace:
        return self.agents[agent_id]

    def _agents_create(self, name: str, tags: list[str], **payload: Any) -> SimpleNamespace:
        self.calls.append("agent.create")
        self._validate(**payload)
        agent = SimpleNamespace(
            agent_id=f"agent_{next(self._ids)}", name=name, tags=tags, **payload
        )
        self.agents[agent.agent_id] = agent
        return agent

    def _agents_update(self, agent_id: str, name: str, tags: list[str], **payload: Any) -> None:
        self.calls.append("agent.update")
        self._validate(**payload)
        agent = self.agents[agent_id]
        agent.name, agent.tags = name, tags
        for key, value in payload.items():
            setattr(agent, key, value)
