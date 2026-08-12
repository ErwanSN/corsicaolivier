import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListPlanningPeriodsQuery {
  @IsUUID()
  declare siteId: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare startsOn?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare endsOn?: string;
}

export class ListScheduleVersionsQuery {
  @IsUUID()
  declare planningPeriodId: string;
}

export class ExportPlanningWeekQuery {
  @IsUUID()
  declare siteId: string;

  @IsDateString({ strict: true })
  declare weekStart: string;
}

export class CreatePlanningShiftDto {
  @IsInt()
  @Min(0)
  declare lockVersion: number;

  @IsUUID()
  declare agentId: string;

  @IsUUID()
  declare positionId: string;

  @IsOptional()
  @IsUUID()
  declare portCallId?: string;

  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;

  @IsInt()
  @Min(0)
  @Max(720)
  declare breakMinutes: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare note?: string;
}

export class MovePlanningAssignmentDto {
  @IsInt()
  @Min(0)
  declare lockVersion: number;

  @IsUUID()
  declare positionId: string;

  @IsDateString({ strict: true })
  declare workDate: string;
}

export class UpdatePlanningAssignmentDto {
  @IsInt()
  @Min(0)
  declare lockVersion: number;

  @IsUUID()
  declare agentId: string;

  @IsUUID()
  declare positionId: string;

  @IsOptional()
  @IsUUID()
  declare portCallId?: string | null;

  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;

  @IsInt()
  @Min(0)
  @Max(720)
  declare breakMinutes: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare note?: string | null;
}

export class DeletePlanningAssignmentDto {
  @IsInt()
  @Min(0)
  declare lockVersion: number;
}

export class PlanningShiftSegmentDto {
  @IsUUID()
  declare positionId: string;

  @IsOptional()
  @IsUUID()
  declare portCallId?: string | null;

  @IsOptional()
  @IsUUID()
  declare staffingRequirementId?: string | null;

  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;
}

export class PlanningShiftBreakDto {
  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  declare label?: string | null;
}

export class SavePlanningShiftServiceDto {
  @IsInt()
  @Min(0)
  declare lockVersion: number;

  @IsUUID()
  declare agentId: string;

  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlanningShiftSegmentDto)
  declare segments: PlanningShiftSegmentDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PlanningShiftBreakDto)
  declare breaks: PlanningShiftBreakDto[];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare note?: string | null;
}

export class PublishScheduleDto {
  @IsInt()
  @Min(0)
  declare lockVersion: number;

  @IsString()
  @Length(3, 500)
  declare reason: string;
}

export class ListReplanningScenariosQuery {
  @IsUUID()
  declare siteId: string;

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
  @IsIn(['draft', 'simulated', 'approved', 'rejected', 'applied'])
  declare status?: 'draft' | 'simulated' | 'approved' | 'rejected' | 'applied';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const raw: unknown[] = Array.isArray(value) ? value : [value];
    return raw.flatMap((item): unknown[] =>
      typeof item === 'string'
        ? item
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        : [item],
    );
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  declare baseScheduleVersionIds?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  declare q?: string;
}

export class ListPlanningWorkforceConflictsQuery {
  @IsUUID()
  declare siteId: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare startsOn?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare endsOn?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  @IsBoolean()
  declare includeResolved?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare limit?: number;
}

export class ResolvePlanningWorkforceConflictDto {
  @IsString()
  @Length(3, 500)
  declare reason: string;
}

export class ApproveReplanningScenarioDto {
  @IsString()
  @Length(3, 500)
  declare reason: string;
}

export class RejectReplanningScenarioDto {
  @IsString()
  @Length(3, 500)
  declare reason: string;
}
