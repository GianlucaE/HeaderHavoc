export type MatchMode = 'glob' | 'regex';
export type Target = 'request' | 'response';

export interface StoredPattern {
    value: string;
    mode: MatchMode;
}

export interface StoredHeader {
    name: string;
    value: string;
    enabled: boolean;
    target: Target;
}

export interface StoredProfile {
    id: string;
    name: string;
    enabled: boolean;
    urlPatterns: StoredPattern[];
    headers: StoredHeader[];
}

export interface StoredConfig {
    enabled: boolean;
    theme: string;
    profiles: StoredProfile[];
}

export type UrlPattern = StoredPattern & { id: string };
export type HeaderMod = StoredHeader & { id: string };

export interface Profile extends StoredProfile {
    urlPatterns: UrlPattern[];
    headers: HeaderMod[];
}

export interface Config extends StoredConfig {
    profiles: Profile[];
}

export interface SyncError {
    profileId: string;
    profileName: string;
    patternValue?: string;
    message: string;
}

export interface RuleIndexEntry {
    ruleId: number;
    profileId: string;
    profileName: string;
    patternValue: string;
    patternMode: MatchMode;
}

export interface SyncReport {
    at: number;
    ruleCount: number;
    errors: SyncError[];
    index: RuleIndexEntry[];
}
