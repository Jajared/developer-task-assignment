/** Static brand + title. Server-rendered and passed into the client shell as a slot. */
export function BacklogHeading() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-500 sm:size-9"
      >
        <span className="size-3.5 rounded-[3px] bg-white" />
      </span>
      <h1 className="truncate text-lg leading-tight font-bold sm:text-[22px]">
        Engineering backlog
      </h1>
    </div>
  );
}
