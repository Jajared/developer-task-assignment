/** Static brand + title. Server-rendered and passed into the client shell as a slot. */
export function BacklogHeading() {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-[10px] bg-violet-500"
      >
        <span className="size-3.5 rounded-[3px] bg-white" />
      </span>
      <h1 className="text-[22px] leading-tight font-bold">
        Engineering backlog
      </h1>
    </div>
  );
}
