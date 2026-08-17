import type {
  Config,
  HeaderMod,
  MatchMode,
  Profile,
  StoredConfig,
  StoredHeader,
  StoredPattern,
  StoredProfile,
  Target,
  UrlPattern,
} from './types';

const DEFAULT_THEME = 'dark';
const DEFAULT_PROFILE_NAME = 'Untitled profile';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asMode(value: unknown): MatchMode {
    return asString(value).toLowerCase() === 'regex' ? 'regex' : 'glob';
}

function asTarget(value: unknown): Target {
    return asString(value).toLowerCase() === 'response' ? 'response' : 'request';
}

function readPatterns(profile: Record<string, unknown>): unknown[] {
    const key = Object.keys(profile).find((k) => k.toLowerCase() === 'urlpatterns');
    return key === undefined ? [] : asArray(profile[key]);
}

function readPattern(input: unknown): UrlPattern {
    const raw = isRecord(input) ? input : {};
    return {id: crypto.randomUUID(), value: asString(raw['value']), mode: asMode(raw['mode'])};
}

function readHeader(input: unknown): HeaderMod {
    const raw = isRecord(input) ? input : {};
    return {
        id: crypto.randomUUID(),
        name: asString(raw['name']),
        value: asString(raw['value']),
        enabled: asBoolean(raw['enabled'], true),
        target: asTarget(raw['target']),
    };
}

function readProfile(input: unknown): Profile {
    const raw = isRecord(input) ? input : {};
    return {
        id: asString(raw['id']) || crypto.randomUUID(),
        name: asString(raw['name'], DEFAULT_PROFILE_NAME),
        enabled: asBoolean(raw['enabled'], false),
        urlPatterns: readPatterns(raw).map(readPattern),
        headers: asArray(raw['headers']).map(readHeader),
    };
}

export function fromStored(input: unknown): Config {
    const raw = isRecord(input) ? input : {};
    return {
        enabled: asBoolean(raw['enabled'], true),
        theme: asString(raw['theme'], DEFAULT_THEME) || DEFAULT_THEME,
        profiles: asArray(raw['profiles']).map(readProfile),
    };
}

function writePattern({value, mode}: UrlPattern): StoredPattern {
    return {value, mode};
}

function writeHeader({name, value, enabled, target}: HeaderMod): StoredHeader {
    return {name, value, enabled, target};
}

function writeProfile(profile: Profile): StoredProfile {
    return {
        id: profile.id,
        name: profile.name,
        enabled: profile.enabled,
        urlPatterns: profile.urlPatterns.map(writePattern),
        headers: profile.headers.map(writeHeader),
    };
}

export function toStored(config: Config): StoredConfig {
    return {
        enabled: config.enabled,
        theme: config.theme,
        profiles: config.profiles.map(writeProfile),
    };
}

export function exportFileName(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return `header-havoc-${stamp}.json`;
}
