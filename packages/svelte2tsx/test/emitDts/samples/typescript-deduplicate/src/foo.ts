export type TestProps = { a: true };

type EventProps = { b: string };

export function eventProps(): { x: EventProps } {
    return { x: { b: 'b' } };
}
