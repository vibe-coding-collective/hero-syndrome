export interface SourceContribution {
  /** Short stable identifier for the source — used in attribution arrays. */
  sourceKey: string;
  /** Pool this source contributes to. */
  pool: 'material' | 'force';
  /** The words contributed (lowercase, no leading/trailing whitespace, no internal duplicates). */
  words: string[];
  /** Provenance for documentation. */
  meta: {
    title: string;
    url: string;
    license: string;
    /** `live` = words extracted from a fetched copy of the source on the date below.
     *  `curated-from-domain` = a representative seed list drawn from the source's domain
     *  register (and the source's canonical content); not the full enumeration. */
    method: 'live' | 'curated-from-domain';
    fetchedAt?: string;
    note?: string;
  };
}
