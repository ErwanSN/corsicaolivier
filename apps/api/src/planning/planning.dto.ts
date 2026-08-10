import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ListPlanningPeriodsQuery {
  @IsUUID()
  declare siteId: string;
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
  @IsUUID()
  declare positionId: string;

  @IsDateString({ strict: true })
  declare workDate: string;
}

export class UpdatePlanningAssignmentDto {
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

export class PublishScheduleDto {
  @IsString()
  @Length(3, 500)
  declare reason: string;
}

export class ListReplanningScenariosQuery {
  @IsUUID()
  declare siteId: string;
}

export class ApproveReplanningScenarioDto {
  @IsString()
  @Length(3, 500)
  declare reason: string;
}
