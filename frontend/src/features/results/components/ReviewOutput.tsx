import { FileText, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import type { Output } from '../../../workspace/_model/output';
import { downloadFile } from '../../../shared/api/httpClient';
import { ReviewFormOutput } from './ReviewFormOutput';

type RecordValue = Record<string, unknown>;
const asRecord = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const asList = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];
const fieldLabels: Record<string, string> = {
  project_title: 'عنوان طرح', proposer: 'مجری / پیشنهاددهنده', summary: 'خلاصه طرح',
  requested_budget: 'بودجه درخواستی',
};
const stageLabels: Record<string, string> = {
  'RV-001': 'دریافت طرح', 'RV-002': 'فرم ارزیابی', 'RV-003': 'استخراج سند',
  'RV-004': 'اعتبارسنجی', 'RV-005': 'ارزیابی کمکی AI', 'RV-006': 'نظر داور',
  'RV-008': 'تصمیم', 'RV-009': 'ارجاع به داور', 'RV-010': 'پاسخ‌های داوران',
};
const statusLabels: Record<string, string> = {
  received: 'دریافت‌شده', awaiting_review: 'در انتظار داوری', reviews_complete: 'داوری تکمیل‌شده',
  scored: 'امتیازدهی‌شده', approved: 'تأییدشده',
  rejected: 'ردشده', revision_requested: 'نیازمند اصلاح', continue: 'ادامه', stopped: 'متوقف‌شده',
};
function display(value: unknown, depth = 0): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('fa-IR');
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (Array.isArray(value)) return value.length ? value.slice(0, 5).map((item) => display(item, depth + 1)).join('، ') : '—';
  if (typeof value === 'object') {
    if (depth > 1) return 'جزئیات ثبت‌شده';
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 5);
    return entries.length ? entries.map(([key, item]) => `${fieldLabels[key] || key}: ${display(item, depth + 1)}`).join(' · ') : '—';
  }
  return String(value);
}

function isLongFieldValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 72 || /[\r\n]/.test(value);
  return Array.isArray(value) || (Boolean(value) && typeof value === 'object');
}

type RadarScore = { id: string; label: string; value: number; maximum: number };

function radarPoint(index: number, count: number, ratio: number, center = 120, radius = 72) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  return {
    x: center + Math.cos(angle) * radius * ratio,
    y: center + Math.sin(angle) * radius * ratio,
  };
}

function radarPoints(count: number, ratio: number) {
  return Array.from({ length: count }, (_, index) => {
    const point = radarPoint(index, count, ratio);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function compactLabel(label: string) {
  return label.length > 18 ? `${label.slice(0, 17)}…` : label;
}

function AIReviewRadar({ scores, labels, maxima }: { scores: RecordValue; labels: RecordValue; maxima: RecordValue }) {
  const criteria = Object.entries(scores).flatMap(([id, raw]) => {
    const value = Number(raw);
    const maximum = Number(maxima[id]);
    if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return [];
    return [{ id, label: String(labels[id] || id), value, maximum } satisfies RadarScore];
  });
  if (criteria.length < 3) return null;
  const scorePoints = criteria.map((criterion, index) => {
    const point = radarPoint(index, criteria.length, Math.min(1, Math.max(0, criterion.value / criterion.maximum)));
    return `${point.x},${point.y}`;
  }).join(' ');
  return <div className="review-ai-score-visual">
    <svg className="review-ai-radar" viewBox="0 0 240 240" role="img" aria-label="نمودار عنکبوتی امتیازهای پیشنهادی هوش مصنوعی">
      <polygon className="review-ai-radar-grid" points={radarPoints(criteria.length, 1)} />
      <polygon className="review-ai-radar-grid review-ai-radar-grid-mid" points={radarPoints(criteria.length, .5)} />
      {criteria.map((criterion, index) => {
        const endpoint = radarPoint(index, criteria.length, 1);
        return <line className="review-ai-radar-axis" key={criterion.id} x1="120" y1="120" x2={endpoint.x} y2={endpoint.y} />;
      })}
      <polygon className="review-ai-radar-area" points={scorePoints} />
      {criteria.map((criterion, index) => {
        const point = radarPoint(index, criteria.length, Math.min(1, Math.max(0, criterion.value / criterion.maximum)));
        return <circle className="review-ai-radar-point" key={criterion.id} cx={point.x} cy={point.y} r="3.5"><title>{`${criterion.label}: ${display(criterion.value)} از ${display(criterion.maximum)}`}</title></circle>;
      })}
      {criteria.map((criterion, index) => {
        const label = radarPoint(index, criteria.length, 1.25);
        return <text className="review-ai-radar-label" key={criterion.id} x={label.x} y={label.y} textAnchor="middle"><title>{criterion.label}</title>{compactLabel(criterion.label)}</text>;
      })}
    </svg>
    <span className="review-ai-radar-caption">مقایسه با سقف هر معیار</span>
  </div>;
}

export function isReviewOutput(output: Output) {
  const kind = String(output.kind || '');
  if (kind === 'review_stage' || kind === 'review_score' || kind === 'review_form' || kind === 'review_batch') return true;
  if (kind === 'json') return Boolean(asRecord(output.value).case_id);
  if (kind === 'metrics') return Boolean(asRecord(output.metrics).criteria && asRecord(output.metrics).form_id);
  return false;
}

function ScoreView({ output }: { output: Output }) {
  const scores = asRecord(output.scores || output.metrics);
  const criteria = asRecord(scores.criteria);
  const labels = asRecord(scores.labels);
  const total = Number(scores.total || 0);
  const maximum = Number(scores.maximum || 0);
  const percent = maximum > 0 ? Math.min(100, Math.max(0, Math.round(total / maximum * 100))) : 0;
  return <div className="review-output review-score-output" dir="rtl">
    <div className="review-output-head"><div><span className="review-output-eyebrow">امتیاز انسانی</span><strong>{String(output.case_id || 'نتیجه ارزیابی')}</strong></div><span className="review-output-pill"><UsersRound size={13} /> {display(scores.reviewer_count)} داور</span></div>
    <div className="review-score-total"><b>{display(total)} <small>از {display(maximum)}</small></b><span>{percent.toLocaleString('fa-IR')}٪</span></div>
    <div className="review-output-progress"><span style={{ width: `${percent}%` }} /></div>
    <div className="review-score-criteria">{Object.entries(criteria).map(([id, raw]) => {
      const value = Number(raw || 0);
      const cap = Number(asRecord(scores.maxima)[id] || 0);
      return <div className="review-score-row" key={id}><span>{String(labels[id] || id)}</span><div className="review-score-track"><i style={{ width: `${cap > 0 ? Math.min(100, value / cap * 100) : maximum > 0 ? Math.min(100, value / maximum * 100) : 0}%` }} /></div><b>{display(value)}</b></div>;
    })}</div>
  </div>;
}

function ReviewResponsesView({ data }: { data: RecordValue }) {
  const responses = asList(data.review_responses);
  const formFields = asList(data.form_fields);
  const fieldsById = new Map(formFields.map((field) => [String(field.id || ''), field]));
  const completed = Number(data.completed_reviews || responses.length);
  const assigned = Number(data.assigned_reviews || responses.length);
  return <div className="review-output review-responses-output" dir="rtl">
    <div className="review-output-head"><div><span className="review-output-eyebrow"><UsersRound size={13} /> امتیازهای ثبت‌شده</span>
      <strong>{String(data.form_title || 'نتیجه داوری')}</strong><small dir="ltr">{String(data.case_id || '')}</small></div>
      <span className="review-output-pill">{display(completed)} از {display(assigned)} پاسخ</span></div>
    {responses.length === 0 ? <p className="review-output-inline">هنوز پاسخی برای نمایش ثبت نشده است.</p>
      : <div className="review-response-list">{responses.map((response, index) => {
        const answers = asRecord(response.answers);
        const total = Number(response.score_total || 0);
        const maximum = Number(response.score_maximum || 0);
        const percent = maximum > 0 ? Math.min(100, Math.max(0, Math.round(total / maximum * 100))) : 0;
        return <section className="review-response-card" key={String(response.task_id || index)}>
          <div className="review-response-head"><div><span>داور</span><strong>{String(response.reviewer_id || `داور ${index + 1}`)}</strong></div>
            {maximum > 0 && <b>{display(total)} <small>از {display(maximum)}</small></b>}</div>
          {maximum > 0 && <div className="review-output-progress"><span style={{ width: `${percent}%` }} /></div>}
          <div className="review-response-answers">{Object.entries(answers).map(([id, value]) => {
            const field = fieldsById.get(id) || {};
            const cap = Number(field.max || 0);
            return <div key={id}><span>{String(field.label || id)}</span><b>{display(value)}{cap > 0 ? <small> / {display(cap)}</small> : null}</b></div>;
          })}</div>
        </section>;
      })}</div>}
  </div>;
}

function AIReviewView({ data }: { data: RecordValue }) {
  const ai = asRecord(data.ai_review);
  const scores = asRecord(ai.scores);
  const labels = asRecord(ai.labels);
  const maxima = asRecord(ai.maxima);
  const evidence = asRecord(ai.evidence);
  const concerns = Array.isArray(ai.concerns) ? ai.concerns.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  const hasReview = Boolean(ai.summary) || Object.keys(scores).length > 0 || Object.keys(evidence).length > 0 || concerns.length > 0;
  return <div className="review-output review-ai-output" dir="rtl">
    <div className="review-output-head"><div><span className="review-output-eyebrow"><Sparkles size={13} /> ارزیابی هوش مصنوعی</span><strong>نتیجه بررسی هوش مصنوعی</strong></div></div>
    {!hasReview ? <p className="review-output-inline">هنوز نتیجه‌ای از هوش مصنوعی ثبت نشده است.</p> : <>
      {ai.summary && <section className="review-output-section"><h4>جمع‌بندی</h4><p>{String(ai.summary)}</p></section>}
      {Object.keys(scores).length > 0 && <section className="review-output-section"><h4>امتیازهای پیشنهادی</h4><div className="review-ai-scores">{Object.entries(scores).map(([key, value]) => <span key={key}>{String(labels[key] || key)}: <b>{display(value)}</b></span>)}</div><AIReviewRadar scores={scores} labels={labels} maxima={maxima} /></section>}
      {concerns.length > 0 && <section className="review-output-section"><h4>نکات قابل توجه</h4><div className="review-ai-findings">{concerns.map((concern, index) => <p className="review-output-finding" key={index}>{concern}</p>)}</div></section>}
      {Object.keys(evidence).length > 0 && <section className="review-output-section"><h4>شواهد بررسی</h4><div className="review-ai-evidence">{Object.entries(evidence).map(([key, raw]) => {
        const item = asRecord(raw);
        const quote = item.quote ?? raw;
        return <article key={key}><b>{String(labels[key] || key)}</b>{item.page !== undefined && <small>صفحه {display(item.page)}</small>}{quote !== undefined && quote !== '' && <p>{display(quote)}</p>}</article>;
      })}</div></section>}
      <small className="review-ai-disclaimer">این نظر جایگزین امتیاز یا تصمیم داور نیست.</small>
    </>}
  </div>;
}

function ReviewBatchOutput({ output }: { output: Output }) {
  const cases = asList(output.cases);
  return <div className="review-output review-batch-output" dir="rtl">
    <div className="review-output-head"><div><span className="review-output-eyebrow">نتایج مستقل پرونده‌ها</span><strong>{String(output.title || 'نتایج گروهی')}</strong></div><span className="review-output-pill">{display(cases.length)} پرونده</span></div>
    <div className="review-batch-list">{cases.map((item, index) => {
      const fields = asRecord(item.fields);
      const ai = asRecord(item.ai_review);
      const scores = asRecord(item.scores || item.metrics);
      const validation = asRecord(item.validation);
      const responses = asList(item.review_responses);
      const total = Number(scores.total ?? responses[0]?.score_total ?? 0);
      const maximum = Number(scores.maximum ?? responses[0]?.score_maximum ?? 0);
      const visibleFields = Object.entries(fields).filter(([key]) => key !== 'project_code' && key !== 'project_title');
      const shortFields = visibleFields.filter(([, value]) => !isLongFieldValue(value));
      const longFields = visibleFields.filter(([, value]) => isLongFieldValue(value));
      return <article className="review-batch-case" key={`${String(item.case_id)}-${index}`}>
        <header><strong>{String(fields.project_title || item.case_id || `پرونده ${index + 1}`)}</strong>{maximum > 0 && <b>{display(total)} <small>از {display(maximum)}</small></b>}</header>
        {visibleFields.length > 0 && <div className="review-batch-fields">{shortFields.map(([key, value]) => <span key={key}><small>{String(asRecord(item.field_labels)[key] || fieldLabels[key] || key)}</small><b>{display(value)}</b></span>)}{longFields.map(([key, value]) => <span className="review-batch-field-long" key={key}><small>{String(asRecord(item.field_labels)[key] || fieldLabels[key] || key)}</small><b>{display(value)}</b></span>)}</div>}
        {Object.keys(ai).length > 0 && <><p>{String(ai.summary || '')}</p><div className="review-ai-scores">{Object.entries(asRecord(ai.scores)).map(([key, value]) => <span key={key}>{String(asRecord(ai.labels)[key] || key)}: <b>{display(value)}</b></span>)}</div></>}
        {Object.keys(validation).length > 0 && <p className={validation.valid === false ? 'review-output-warning' : 'review-output-success'}>{validation.valid === false ? `${asList(validation.errors).length.toLocaleString('fa-IR')} مورد نیازمند بررسی` : 'اطلاعات ضروری کامل است'}</p>}
        {responses.length > 0 && <div className="review-batch-responses">{responses.map((response, responseIndex) => <span key={String(response.task_id || responseIndex)}><small>{String(response.reviewer_id || `داور ${responseIndex + 1}`)}</small><b>{display(response.score_total)} / {display(response.score_maximum)}</b></span>)}</div>}
      </article>;
    })}{cases.length === 0 && <p className="review-output-inline">پرونده‌ای برای نمایش وجود ندارد.</p>}</div>
  </div>;
}

export function ReviewOutput({ output }: { output: Output }) {
  const kind = String(output.kind || '');
  if (kind === 'review_batch') return <ReviewBatchOutput output={output} />;
  if (kind === 'review_score' || kind === 'metrics') return <ScoreView output={output} />;
  if (kind === 'review_form') return <ReviewFormOutput output={output} />;
  const data = kind === 'json' ? asRecord(output.value) : output;
  const fields = asRecord(data.fields);
  const labels = asRecord(data.field_labels);
  const documents = asList(data.documents);
  const validation = asRecord(data.validation);
  const ai = asRecord(data.ai_review);
  const decision = asRecord(data.decision);
  const stage = String(data.stage || '');
  if (stage === 'RV-010') return <ReviewResponsesView data={data} />;
  if (stage === 'RV-005') return <AIReviewView data={data} />;
  const title = String(fields.project_title || data.form_title || data.case_id || 'پرونده');
  const visibleFields = Object.entries(fields)
    .filter(([key]) => key !== 'project_code' && (stage === 'RV-004' || key !== 'project_title'))
    .slice(0, data.input_mode === 'static' ? undefined : 12);
  return <div className="review-output" dir="rtl">
    <div className="review-output-head"><div><span className="review-output-eyebrow">{stageLabels[stage] || 'پرونده بررسی'}</span><strong>{title}</strong><small dir="ltr">{String(data.case_id || '')}</small></div><span className="review-output-pill">{statusLabels[String(data.status || '')] || String(data.status || 'در جریان')}</span></div>
    {visibleFields.length > 0 && <div className={`review-output-fields${stage === 'RV-004' ? ' review-validation-extracted-fields' : ''}`}>{visibleFields.map(([key, value]) => <div key={key}><span>{String(labels[key] || fieldLabels[key] || key)}</span><b>{display(value)}</b></div>)}</div>}
    {documents.length > 0 && <section className="review-output-section"><h4><FileText size={15} /> اسناد پرونده</h4><div className="review-output-documents">{documents.map((document, index) => <button type="button" key={`${document.artifact_id}-${index}`} onClick={() => {
      const id = Number(document.artifact_id);
      if (Number.isSafeInteger(id) && id > 0) void downloadFile(`/api/artifacts/${id}/download`, String(document.filename || `document-${id}`));
    }}><FileText size={14} /><span>{String(document.filename || `سند ${index + 1}`)}</span>{document.pages ? <small>{display(document.pages)} صفحه</small> : null}</button>)}</div></section>}
    {Object.keys(validation).length > 0 && <section className="review-output-section"><h4><ShieldCheck size={15} /> کنترل پرونده</h4><p className={validation.valid === false ? 'review-output-warning' : 'review-output-success'}>{validation.valid === false ? 'برخی اطلاعات ضروری ناقص است.' : 'اطلاعات ضروری تکمیل شده است.'}</p>{asList(validation.errors).map((item, index) => <p className="review-output-finding" key={index}>{String(item.message || item.field || 'فیلد ناقص')}</p>)}{asList(validation.advisory).map((item, index) => <p className="review-output-finding" key={`a${index}`}>{String(item.message || '')}</p>)}</section>}
    {Object.keys(ai).length > 0 && <section className="review-output-section"><h4><Sparkles size={15} /> نظر کمکی هوش مصنوعی</h4><p>{String(ai.summary || 'خلاصه‌ای ثبت نشده است.')}</p><div className="review-ai-scores">{Object.entries(asRecord(ai.scores)).map(([key, value]) => <span key={key}>{String(asRecord(ai.labels)[key] || key)}: <b>{display(value)}</b></span>)}</div><small>این نظر جایگزین امتیاز یا تصمیم داور نیست.</small></section>}
    {data.field_count !== undefined && <p className="review-output-inline">{display(data.field_count)} فیلد در فرم «{String(data.form_title || data.form_id || '')}» تعریف شد.</p>}
    {data.assigned_reviewers !== undefined && <p className="review-output-inline">فرم برای {display(data.assigned_reviewers)} داور ارسال شد. پاسخ‌ها در کارتابل داوری ثبت می‌شوند.</p>}
    {data.completed_reviews !== undefined && <p className="review-output-inline">{display(data.completed_reviews)} پاسخ از {display(data.assigned_reviews)} وظیفه دریافت شد.</p>}
    {Object.keys(decision).length > 0 && <p className="review-output-inline">تصمیم: {statusLabels[String(decision.outcome || '')] || String(decision.outcome || '')} · {String(decision.reason || '')}</p>}
  </div>;
}
