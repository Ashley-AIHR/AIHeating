import { useMemo, useState, type FormEvent } from 'react';
import {
  askTutor,
  buildTutorContext,
  suggestedTutorQuestions,
  type TutorConversationTurn,
  type TutorLanguage,
  type TutorPage,
  type TutorResponse,
} from './p8-tutor';
import { deriveCustomerStatus, getGuidedRuntime, type ApplicationStatus, type RuntimeMode } from './p7-provider';

interface TutorPanelProps {
  page: TutorPage;
  language: TutorLanguage;
  mode: RuntimeMode;
  selectedBuildingId: string | null;
  applicationState: ApplicationStatus;
  semanticEvents: Array<{ type: string; at: string }>;
}

const labels = {
  en: {
    title: 'AI Tutor', role: 'Explanation only', source: 'P7 structured state',
    placeholder: 'Ask about this page…', ask: 'Ask', close: 'Close', details: 'Technical evidence',
    unavailable: 'Tutor unavailable; simulation and control are unaffected.',
  },
  zh: {
    title: 'AI Tutor', role: '仅提供解释', source: 'P7 结构化状态',
    placeholder: '询问当前页面…', ask: '提问', close: '关闭', details: '技术证据',
    unavailable: 'Tutor 不可用；仿真和控制不受影响。',
  },
} as const;

export function TutorPanel(props: TutorPanelProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [responses, setResponses] = useState<Array<{ question: string; response: TutorResponse }>>([]);
  const text = labels[props.language];
  const runtime = getGuidedRuntime();
  const context = useMemo(() => buildTutorContext({
    page: props.page, controlMode: props.mode, selectedBuildingId: props.selectedBuildingId,
    applicationState: props.applicationState, semanticEvents: props.semanticEvents,
  }), [props.page, props.mode, props.selectedBuildingId, props.applicationState, props.semanticEvents]);
  const status = deriveCustomerStatus(runtime.optimisation.status);
  const suggestions = suggestedTutorQuestions(props.page, props.language, status);

  const submit = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const responseLanguage: TutorLanguage = /[\u3400-\u9fff]/.test(trimmed) ? 'zh' : /[A-Za-z]/.test(trimmed) ? 'en' : props.language;
    const conversation: TutorConversationTurn[] = responses.slice(-3).flatMap((item) => [
      { role: 'user' as const, text: item.question, contextId: item.response.contextId },
      { role: 'assistant' as const, text: item.response.answer, contextId: item.response.contextId },
    ]);
    try {
      const response = await askTutor({ context, question: trimmed, language: responseLanguage, conversation });
      setResponses((current) => [...current.slice(-3), { question: trimmed, response }]);
      setQuestion('');
    } catch {
      setResponses((current) => [...current.slice(-3), {
        question: trimmed,
        response: {
          answer: text.unavailable, answerType: 'SAFE_FALLBACK', language: props.language,
          contextId: context.contextId, evidenceRefs: [], knowledgeRefs: [], sourceBoundary: 'P7_STRUCTURED_PROVIDER_ONLY',
          confidence: 'LOW', limitations: context.limitations, controlActionRequested: false,
          provider: { name: 'Tutor boundary', model: 'unavailable' }, latencyMs: 0,
          validationStatus: 'FAILED', fallbackResponseUsed: true, validationReasons: ['UI_PROVIDER_FAILURE'],
          questionCategory: 'UNSUPPORTED',
        },
      }]);
    } finally { setBusy(false); }
  };
  const onSubmit = (event: FormEvent) => { event.preventDefault(); void submit(); };

  return (
    <aside className={`tutor ${open ? 'open' : ''}`} aria-label={text.title}>
      {!open ? (
        <button className="tutor-launch" onClick={() => setOpen(true)}>✦ {text.title}</button>
      ) : (
        <div className="tutor-card">
          <header>
            <div><b>✦ {text.title}</b><small>{text.role} · {runtime.scenario}</small></div>
            <button onClick={() => setOpen(false)} aria-label={text.close}>×</button>
          </header>
          <div className="tutor-context">
            <span>{runtime.simulationTime.slice(11, 16)}</span>
            {props.selectedBuildingId && <span>{props.selectedBuildingId}</span>}
            <span className="available">● {text.source}</span>
          </div>
          <div className="tutor-suggestions">
            {suggestions.map((item) => <button key={item} onClick={() => void submit(item)}>{item}</button>)}
          </div>
          <div className="tutor-messages" aria-live="polite">
            {responses.length === 0 && <p>{suggestions[0]}</p>}
            {responses.map((item, index) => (
              <div key={`${item.response.contextId}-${index}`}>
                <span>{item.question}</span>
                <p>{item.response.answer}</p>
                <details>
                  <summary>{text.details}</summary>
                  <small>{item.response.questionCategory} · {item.response.provider.model} · {item.response.validationStatus} · {item.response.contextId}<br />evidence: {item.response.evidenceRefs.join(', ') || 'domain knowledge / limitation'}</small>
                </details>
              </div>
            ))}
            {busy && <p>…</p>}
          </div>
          <form onSubmit={onSubmit}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text.placeholder} aria-label={text.placeholder} />
            <button disabled={busy || !question.trim()}>{text.ask}</button>
          </form>
        </div>
      )}
    </aside>
  );
}
