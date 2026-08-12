import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const AGENT_STATUSES = ['active', 'inactive', 'all'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

function commaSeparatedValues(value: unknown): unknown {
  const values: readonly unknown[] = Array.isArray(value)
    ? (value as unknown[])
    : [value];
  const parsed: unknown[] = [];

  for (const item of values) {
    if (typeof item !== 'string') {
      parsed.push(item);
      continue;
    }

    parsed.push(
      ...item
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    );
  }

  return parsed;
}

export class ListAgentsQuery {
  @IsOptional()
  @IsUUID()
  declare siteId?: string;

  @IsOptional()
  @IsUUID()
  declare organizationId?: string;
}

export class SearchAgentsQuery extends ListAgentsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  declare page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare pageSize?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  declare q?: string;

  @IsOptional()
  @IsIn(AGENT_STATUSES)
  declare status?: AgentStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => commaSeparatedValues(value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  declare includeIds?: string[];
}

export class CreateAgentDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare primarySiteId: string;

  @IsOptional()
  @IsUUID()
  declare userId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,32}$/)
  declare employeeNumber?: string;

  @IsString()
  @Length(1, 160)
  declare displayName: string;

  @IsOptional()
  @IsBoolean()
  declare active?: boolean;

  @IsOptional()
  @IsDateString({ strict: true })
  declare hiredOn?: string;
}

export class UpdateAgentDto {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsUUID()
  declare primarySiteId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,32}$/)
  declare employeeNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  declare displayName?: string;

  @IsOptional()
  @IsBoolean()
  declare active?: boolean;

  @IsOptional()
  @IsDateString({ strict: true })
  declare hiredOn?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  declare leftOn?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  declare offboardingReason?: string;
}

export class ReactivateAgentDto {
  @IsUUID()
  declare organizationId: string;

  @IsString()
  @Length(3, 500)
  declare reason: string;
}

export class RetryAgentOffboardingDto {
  @IsUUID()
  declare organizationId: string;

  @IsString()
  @Length(3, 500)
  declare reason: string;
}
