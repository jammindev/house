"""AnswerResult -> Telegram HTML rendering."""
from __future__ import annotations

from agent.service import AnswerResult, Citation

from telegram.rendering import TELEGRAM_MESSAGE_LIMIT, render_answer

FRONTEND = "https://house.example.com"


def _citation(entity_type="task", id="42", label="Purger la VMC", url_path="/app/tasks/42"):
    return Citation(entity_type=entity_type, id=id, label=label, snippet="", url_path=url_path)


class TestRenderAnswer:
    def test_plain_answer_is_escaped(self):
        result = AnswerResult(answer="1 < 2 & 3 > 2", citations=[])
        chunks = render_answer(result, FRONTEND)
        assert chunks == ["1 &lt; 2 &amp; 3 &gt; 2"]

    def test_cite_marker_becomes_numbered_link_with_footer(self):
        result = AnswerResult(
            answer='Tu as payé 199 € <cite id="task:42"/> pour ça.',
            citations=[_citation()],
        )
        [chunk] = render_answer(result, FRONTEND)
        assert '<a href="https://house.example.com/app/tasks/42">[1]</a>' in chunk
        assert '1. <a href="https://house.example.com/app/tasks/42">Purger la VMC</a>' in chunk
        assert "<cite" not in chunk

    def test_repeated_marker_keeps_same_number(self):
        result = AnswerResult(
            answer='A <cite id="task:42"/> et B <cite id="task:42"/>.',
            citations=[_citation()],
        )
        [chunk] = render_answer(result, FRONTEND)
        assert chunk.count(">[1]</a>") == 2
        assert chunk.count("\n1. ") == 1

    def test_unknown_marker_is_dropped(self):
        result = AnswerResult(answer='Voir <cite id="task:999"/>.', citations=[])
        assert render_answer(result, FRONTEND) == ["Voir ."]

    def test_uncited_resolved_citation_lands_in_footer(self):
        result = AnswerResult(answer="Sans marqueur.", citations=[_citation()])
        [chunk] = render_answer(result, FRONTEND)
        assert "1. <a href=" in chunk

    def test_citation_label_is_escaped(self):
        result = AnswerResult(
            answer='X <cite id="task:1"/>',
            citations=[_citation(id="1", label="A <b> & B", url_path="/app/tasks/1")],
        )
        [chunk] = render_answer(result, FRONTEND)
        assert "A &lt;b&gt; &amp; B" in chunk

    def test_empty_answer_yields_no_chunk(self):
        assert render_answer(AnswerResult(answer="", citations=[]), FRONTEND) == []

    def test_long_answer_is_chunked_on_line_boundaries(self):
        lines = [f"ligne {i} " + "x" * 80 for i in range(80)]
        result = AnswerResult(answer="\n".join(lines), citations=[])
        chunks = render_answer(result, FRONTEND)
        assert len(chunks) > 1
        assert all(len(c) <= TELEGRAM_MESSAGE_LIMIT for c in chunks)
        # No line was cut in half.
        assert "".join(chunks).replace("\n", "") == "".join(lines).replace("\n", "")

    def test_pathological_single_line_is_hard_split(self):
        result = AnswerResult(answer="y" * (TELEGRAM_MESSAGE_LIMIT + 10), citations=[])
        chunks = render_answer(result, FRONTEND)
        assert len(chunks) == 2
        assert all(len(c) <= TELEGRAM_MESSAGE_LIMIT for c in chunks)
