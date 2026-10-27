// Commands on the approval journey (schema.ts). Each returns a new document; the store makes each one
// undo step. The project takes its own journey the first time it changes.

import type { Doc } from '../app/document';
import { newId } from '../core/id';
import type { Command } from '../core/store';
import { type Approval, type ApprovalDoc, approvalOf, type ApprovalStep } from './schema';

const change = (label: string, f: (a: Approval) => Approval): Command<Doc> => ({
  label,
  apply: (doc) => {
    const before = approvalOf(doc);
    const after = f(before);
    return JSON.stringify(after) === JSON.stringify(before) ? doc : { ...doc, approval: after };
  },
});

/** What is set to undefined is taken off: an estimate or a note cleared. */
const clean = <T>(x: object): T => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T;

export const setCity = (city: string): Command<Doc> => change('cmd.approval', (a) => ({ ...a, city }));

export const updateStep = (id: string, patch: { readonly name?: string; readonly days?: number | undefined; readonly cost?: number | undefined }): Command<Doc> =>
  change('cmd.approval', (a) => ({ ...a, steps: a.steps.map((s) => (s.id === id ? clean<ApprovalStep>({ ...s, ...patch }) : s)) }));

export const updateDoc = (step: string, id: string, patch: { readonly name?: string; readonly issuer?: string; readonly state?: ApprovalDoc['state']; readonly note?: string | undefined }): Command<Doc> =>
  change('cmd.approval', (a) => ({ ...a, steps: a.steps.map((s) => (s.id === step ? { ...s, docs: s.docs.map((d) => (d.id === id ? clean<ApprovalDoc>({ ...d, ...patch }) : d)) } : s)) }));

export const addDoc = (step: string, name: string): Command<Doc> =>
  change('cmd.approval', (a) => ({ ...a, steps: a.steps.map((s) => (s.id === step ? { ...s, docs: [...s.docs, { id: newId('doc'), name, issuer: '', state: 'todo' as const }] } : s)) }));

export const deleteDoc = (step: string, id: string): Command<Doc> =>
  change('cmd.approval', (a) => ({ ...a, steps: a.steps.map((s) => (s.id === step ? { ...s, docs: s.docs.filter((d) => d.id !== id) } : s)) }));

export const addStep = (name: string): Command<Doc> => change('cmd.approval', (a) => ({ ...a, steps: [...a.steps, { id: newId('step'), name, docs: [] } satisfies ApprovalStep] }));

export const deleteStep = (id: string): Command<Doc> => change('cmd.approval', (a) => ({ ...a, steps: a.steps.filter((s) => s.id !== id) }));
