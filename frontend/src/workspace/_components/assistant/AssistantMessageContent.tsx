import { Fragment, type ReactNode } from 'react';
function renderInlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
    return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
        const key = `${keyPrefix}-${index}`;
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={key}>{renderInlineMarkdown(part.slice(2, -2), `${key}-strong`)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={key}>{part.slice(1, -1)}</code>;
        }
        return <Fragment key={key}>{part}</Fragment>;
    });
}
export function AssistantMessageContent({ content }: {
    content: string;
}) {
    const lines = content.replace(/\r\n?/g, '\n').split('\n');
    const blocks: ReactNode[] = [];
    let index = 0;
    while (index < lines.length) {
        const line = lines[index].trim();
        if (!line) {
            index += 1;
            continue;
        }
        const heading = line.match(/^#{1,4}\s+(.+)$/);
        if (heading) {
            blocks.push(<h4 key={`heading-${index}`}>{renderInlineMarkdown(heading[1], `heading-${index}`)}</h4>);
            index += 1;
            continue;
        }
        const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
        if (ordered) {
            const items: ReactNode[] = [];
            const start = Number(ordered[1]);
            while (index < lines.length) {
                const item = lines[index].trim().match(/^(\d+)[.)]\s+(.+)$/);
                if (!item)
                    break;
                items.push(<li key={`ordered-${index}`}>{renderInlineMarkdown(item[2], `ordered-${index}`)}</li>);
                index += 1;
            }
            blocks.push(<ol key={`ordered-list-${index}`} start={start}>{items}</ol>);
            continue;
        }
        const unordered = line.match(/^[-•]\s+(.+)$/);
        if (unordered) {
            const items: ReactNode[] = [];
            while (index < lines.length) {
                const item = lines[index].trim().match(/^[-•]\s+(.+)$/);
                if (!item)
                    break;
                items.push(<li key={`unordered-${index}`}>{renderInlineMarkdown(item[1], `unordered-${index}`)}</li>);
                index += 1;
            }
            blocks.push(<ul key={`unordered-list-${index}`}>{items}</ul>);
            continue;
        }
        const paragraphLines = [line];
        index += 1;
        while (index < lines.length) {
            const next = lines[index].trim();
            if (!next || /^#{1,4}\s+/.test(next) || /^\d+[.)]\s+/.test(next) || /^[-•]\s+/.test(next))
                break;
            paragraphLines.push(next);
            index += 1;
        }
        blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(paragraphLines.join(' '), `paragraph-${index}`)}</p>);
    }
    return <div className="assistant-message-content">{blocks}</div>;
}
