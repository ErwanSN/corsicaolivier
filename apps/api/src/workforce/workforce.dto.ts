import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListGroupsQuery {
  @IsOptional()
  @IsUUID()
  declare siteId?: string;
}

export class ListAgentUnavailabilityQuery {
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
  @IsEnum(['upcoming', 'past', 'all'])
  declare scope?: 'upcoming' | 'past' | 'all';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  declare q?: string;
}

export class GetHourBalanceQuery {
  @IsUUID()
  declare agentId: string;

  @IsDateString({ strict: true })
  declare weekStart: string;

  @IsOptional()
  @IsUUID()
  declare scheduleVersionId?: string;
}

export class ListHourTargetsQuery {
  @IsOptional()
  @IsUUID()
  declare siteId?: string;

  @IsDateString({ strict: true })
  declare weekStart: string;
}

export class SetAgentContractDto {
  @IsUUID()
  declare organizationId: string;

  @IsDateString({ strict: true })
  declare effectiveFrom: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare effectiveUntil?: string;

  @IsInt()
  @Min(0)
  @Max(10080)
  declare weeklyTargetMinutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(44640)
  declare monthlyTargetMinutes?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  declare label?: string;
}

export class CreateGroupDto {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsUUID()
  declare siteId?: string;

  @IsOptional()
  @Matches(/^[A-Z0-9-]{1,24}$/)
  declare code?: string;

  @IsString()
  @Length(1, 120)
  declare name: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare description?: string;
}

export class AddGroupMemberDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare agentId: string;

  @IsDateString({ strict: true })
  declare effectiveFrom: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare effectiveUntil?: string;

  @IsOptional()
  @IsBoolean()
  declare isPrimary?: boolean;
}

export class SetGroupHourTargetsDto {
  @IsUUID()
  declare organizationId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  declare weeklyTargetMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(44640)
  declare monthlyTargetMinutes?: number | null;
}

export class EndGroupMembershipDto {
  @IsUUID()
  declare organizationId: string;

  @IsDateString({ strict: true })
  declare effectiveUntil: string;
}

export class SetHourTargetDto {
  @IsUUID()
  declare organizationId: string;

  @ValidateIf((input: SetHourTargetDto) => Boolean(input.agentId))
  @IsUUID()
  declare siteId?: string;

  @ValidateIf((input: SetHourTargetDto) => !input.groupId)
  @IsUUID()
  declare agentId?: string;

  @ValidateIf((input: SetHourTargetDto) => !input.agentId)
  @IsUUID()
  declare groupId?: string;

  @IsDateString({ strict: true })
  declare weekStart: string;

  @IsInt()
  @Min(0)
  @Max(10080)
  declare targetMinutes: number;

  @IsString()
  @Length(3, 500)
  declare reason: string;
}

export class SetPositionPreferenceDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare positionId: string;

  @IsEnum(['preferred', 'neutral', 'avoid'])
  declare level: 'preferred' | 'neutral' | 'avoid';

  @IsInt()
  @Min(1)
  @Max(5)
  declare priority: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare note?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare validFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare validUntil?: string;
}

export class SetPositionRestrictionDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare positionId: string;

  @IsString()
  @Length(3, 500)
  declare reason: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare validFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare validUntil?: string;
}

export class SetAgentSkillDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare skillId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  declare level: number;

  @IsOptional()
  @IsDateString({ strict: true })
  declare validFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare validUntil?: string;
}

export class SetPositionSkillRequirementDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare skillId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  declare minimumLevel: number;

  @IsBoolean()
  declare mandatory: boolean;
}

export class CreateAgentUnavailabilityDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare siteId: string;

  @IsEnum(['leave', 'training', 'medical', 'rest', 'other'])
  declare kind: 'leave' | 'training' | 'medical' | 'rest' | 'other';

  @IsDateString()
  declare startsAt: string;

  @IsDateString()
  declare endsAt: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare note?: string;
}

export class EndAgentUnavailabilityDto {
  @IsDateString()
  declare endsAt: string;
}
