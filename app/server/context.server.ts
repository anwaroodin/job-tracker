import { createContext } from "react-router";

/**
 * Typed load-context slots. Populated in workers/app.ts on every request and
 * read from loaders/actions with `context.get(envContext)`.
 */
export const envContext = createContext<Env>();
export const execContext = createContext<ExecutionContext>();
