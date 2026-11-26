import path from "node:path";

type Session = {
  projectRoot: string;
  currentSpec: string | null;
  openProcess: { pid: number; startedAt: string } | null;
};

const session: Session = {
  projectRoot: process.cwd(),
  currentSpec: null,
  openProcess: null,
};

export function getSession(): Readonly<Session> {
  return session;
}

export function setProjectRoot(root: string): void {
  session.projectRoot = path.resolve(root);
}

export function setCurrentSpec(abs: string | null): void {
  session.currentSpec = abs ? path.resolve(abs) : null;
}

export function setOpenProcess(p: { pid: number; startedAt: string } | null): void {
  session.openProcess = p;
}
