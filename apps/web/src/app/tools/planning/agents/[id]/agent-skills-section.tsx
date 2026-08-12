import { PlatformSelect } from '../../../../../components/ui/platform-select';
import type { Agent, AgentSkill, Skill } from '../../../../../lib/api/types';
import { setAgentSkill } from '../../actions';
import { activeOn } from './agent-detail-utils';

type AgentSkillsSectionProps = Readonly<{
  agent: Agent;
  agentSkills: readonly AgentSkill[];
  loadFailed: boolean;
  skills: readonly Skill[];
  today: string;
}>;

export function AgentSkillsSection({
  agent,
  agentSkills,
  loadFailed,
  skills,
  today,
}: AgentSkillsSectionProps) {
  const activeAgentSkills = agentSkills.filter((agentSkill) =>
    activeOn(agentSkill.valid_from, agentSkill.valid_until, today),
  );
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));

  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        Compétences ·{' '}
        {loadFailed
          ? 'données indisponibles'
          : `${activeAgentSkills.length} active${activeAgentSkills.length > 1 ? 's' : ''}`}
      </summary>
      <div className="mt-5">
        {activeAgentSkills.length ? (
          <ul className="flex flex-wrap gap-2">
            {activeAgentSkills.map((agentSkill) => (
              <li
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm"
                key={agentSkill.id}
              >
                {skillById.get(agentSkill.skill_id)?.name ??
                  'Compétence archivée'}{' '}
                <span className="text-zinc-500">
                  · niveau {agentSkill.level}
                </span>
              </li>
            ))}
          </ul>
        ) : loadFailed ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            Les compétences ne peuvent pas être chargées pour le moment.
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Aucune compétence active enregistrée.
          </p>
        )}

        {!loadFailed ? (
          <details className="mt-5 border-t border-zinc-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
              + Ajouter ou actualiser une compétence
            </summary>
            {skills.length ? (
              <form
                action={setAgentSkill}
                className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
              >
                <input
                  name="organizationId"
                  type="hidden"
                  value={agent.organization_id}
                />
                <input
                  name="siteId"
                  type="hidden"
                  value={agent.primary_site_id}
                />
                <input name="agentId" type="hidden" value={agent.id} />
                <input name="validFrom" type="hidden" value={today} />
                <div className="space-y-2">
                  <label className="field-label" htmlFor="agentSkill">
                    Compétence
                  </label>
                  <PlatformSelect id="agentSkill" name="skillId" required>
                    <option value="">Choisir…</option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </PlatformSelect>
                </div>
                <div className="space-y-2">
                  <label className="field-label" htmlFor="agentSkillLevel">
                    Niveau
                  </label>
                  <PlatformSelect
                    defaultValue="1"
                    id="agentSkillLevel"
                    name="level"
                    required
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level} / 5
                      </option>
                    ))}
                  </PlatformSelect>
                </div>
                <button className="primary-button" type="submit">
                  Enregistrer
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                Créez d’abord les compétences dans les réglages.
              </p>
            )}
          </details>
        ) : null}
      </div>
    </details>
  );
}
