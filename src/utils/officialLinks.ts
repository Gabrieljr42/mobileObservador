import type { Concurso } from '../types/concurso';

export type OfficialActionLink = { label: string; url: string };

const cleanUrl = (value?: string | null) => value?.trim() || null;

/** Signed object-storage URLs are evidence of the observed document, not a durable UI destination. */
export const isTemporarySignedUrl = (value?: string | null) => (
  !!value && /[?&]X-Amz-(?:Signature|Credential|Algorithm)=/i.test(value)
);

export const concursoActionLinks = (
  concurso: Pick<Concurso, 'link_inscricao' | 'link_edital' | 'link_pagina'>,
): { primary: OfficialActionLink | null; edital: OfficialActionLink | null } => {
  const registration = cleanUrl(concurso.link_inscricao);
  const page = cleanUrl(concurso.link_pagina);
  const edital = cleanUrl(concurso.link_edital);
  const primary = registration
    ? { label: 'Inscrever-se', url: registration }
    : page
      ? { label: 'Página oficial', url: page }
      : null;
  const editalAction = edital && !isTemporarySignedUrl(edital)
    ? { label: 'Abrir edital', url: edital }
    : edital && page
      ? { label: 'Edital na página oficial', url: page }
      : null;
  return { primary, edital: editalAction };
};
