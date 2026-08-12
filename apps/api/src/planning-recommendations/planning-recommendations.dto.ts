import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlanningCandidateSegmentDto {
  @IsUUID()
  declare positionId: string;

  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;
}

export class PlanningCandidateBreakDto {
  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;
}

export class FindPlanningCandidatesDto {
  @IsDateString({ strict: true })
  declare startsAt: string;

  @IsDateString({ strict: true })
  declare endsAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlanningCandidateSegmentDto)
  declare segments: PlanningCandidateSegmentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlanningCandidateBreakDto)
  declare breaks?: PlanningCandidateBreakDto[];

  @IsOptional()
  @IsUUID()
  declare excludedShiftId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 80)
  declare q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  declare limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  declare offset?: number;
}
