import { FormEvent, useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Layout from "../components/Layout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface OrganizationProfile {
  _id: string;
  name: string;
  description: string;
  website: string;
  contactEmail: string;
}

interface Prize {
  place: string;
  description: string;
}

interface HackathonResult {
  place: string;
  teamName: string;
  projectName: string;
  description: string;
}

interface Registration {
  _id: string;
  team?: { _id: string; name: string };
  teamName?: string;
  student?: { _id: string; name: string; email: string };
  projectName?: string;
  status: "pending" | "accepted" | "rejected";
  registeredAt: string;
}

interface Hackathon {
  _id: string;
  title: string;
  description: string;
  eligibility: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  prizes: Prize[];
  published: boolean;
  stage: "registration" | "judging" | "completed";
  results: HackathonResult[];
  resultsPublished: boolean;
}

interface HackathonDraft {
  title: string;
  description: string;
  eligibility: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  prizesText: string;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new ApiError("Your session is missing. Please sign in again.", 401);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      result.message || "The request could not be completed",
      response.status
    );
  }
  return result as T;
}

const emptyHackathonDraft: HackathonDraft = {
  title: "",
  description: "",
  eligibility: "",
  registrationDeadline: "",
  startDate: "",
  endDate: "",
  prizesText: "",
};

const parsePrizes = (value: string): Prize[] =>
  value
    .split("\n")
    .map((line) => line.split("|", 2).map((part) => part.trim()))
    .filter(([place, description]) => Boolean(place && description))
    .map(([place, description]) => ({ place, description }));

const parseResults = (value: string): HackathonResult[] =>
  value
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([place, teamName]) => Boolean(place && teamName))
    .map(([place, teamName, projectName = "", description = ""]) => ({
      place,
      teamName,
      projectName,
      description,
    }));

export default function OrganizationPage() {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [organizationDraft, setOrganizationDraft] = useState({
    name: "",
    description: "",
    website: "",
    contactEmail: "",
  });
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [hackathonDraft, setHackathonDraft] =
    useState<HackathonDraft>(emptyHackathonDraft);
  const [editingHackathon, setEditingHackathon] = useState<string | null>(null);
  const [registrationsByHackathon, setRegistrationsByHackathon] = useState<
    Record<string, Registration[]>
  >({});
  const [registrationStatuses, setRegistrationStatuses] = useState<
    Record<string, Registration["status"]>
  >({});
  const [stageDrafts, setStageDrafts] = useState<
    Record<string, Hackathon["stage"]>
  >({});
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});
  const [accountRole, setAccountRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const { organization } = await apiRequest<{
        organization: OrganizationProfile;
      }>("/organizations/mine");
      setProfile(organization);
      setOrganizationDraft({
        name: organization.name,
        description: organization.description,
        website: organization.website,
        contactEmail: organization.contactEmail,
      });

      const { hackathons: ownedHackathons } = await apiRequest<{
        hackathons: Hackathon[];
      }>("/organizations/mine/hackathons");
      setHackathons(ownedHackathons);
      setStageDrafts(
        Object.fromEntries(
          ownedHackathons.map((hackathon) => [
            hackathon._id,
            hackathon.stage,
          ])
        )
      );
      setResultDrafts(
        Object.fromEntries(
          ownedHackathons.map((hackathon) => [
            hackathon._id,
            hackathon.results
              .map((result) =>
                [
                  result.place,
                  result.teamName,
                  result.projectName,
                  result.description,
                ].join(" | ")
              )
              .join("\n"),
          ])
        )
      );
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 404) {
        setProfile(null);
        setHackathons([]);
        setError("");
      } else {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load organization management"
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        setAccountRole(JSON.parse(user).role || "");
      } catch {
        setAccountRole("");
      }
    }
    loadData();
  }, [loadData]);

  const handleOrganizationSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(
        profile ? "/organizations/mine" : "/organizations",
        {
          method: profile ? "PATCH" : "POST",
          body: JSON.stringify(organizationDraft),
        }
      );
      setNotice("Organization profile saved.");
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save organization profile"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleHackathonSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: hackathonDraft.title,
        description: hackathonDraft.description,
        eligibility: hackathonDraft.eligibility,
        registrationDeadline: hackathonDraft.registrationDeadline,
        startDate: hackathonDraft.startDate,
        endDate: hackathonDraft.endDate,
        prizes: parsePrizes(hackathonDraft.prizesText),
      };
      await apiRequest(
        editingHackathon
          ? `/hackathons/${editingHackathon}`
          : "/organizations/mine/hackathons",
        {
          method: editingHackathon ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setHackathonDraft(emptyHackathonDraft);
      setEditingHackathon(null);
      setNotice(editingHackathon ? "Hackathon updated." : "Hackathon created as a draft.");
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save hackathon"
      );
    } finally {
      setSaving(false);
    }
  };

  const editHackathon = (hackathon: Hackathon) => {
    setEditingHackathon(hackathon._id);
    setHackathonDraft({
      title: hackathon.title,
      description: hackathon.description,
      eligibility: hackathon.eligibility,
      registrationDeadline: hackathon.registrationDeadline.slice(0, 10),
      startDate: hackathon.startDate.slice(0, 10),
      endDate: hackathon.endDate.slice(0, 10),
      prizesText: hackathon.prizes
        .map((prize) => `${prize.place} | ${prize.description}`)
        .join("\n"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const publishHackathon = async (id: string) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/hackathons/${id}/publish`, { method: "POST" });
      setNotice("Hackathon published.");
      await loadData();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Could not publish hackathon"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (id: string) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/hackathons/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: stageDrafts[id] }),
      });
      setNotice("Hackathon stage updated.");
      await loadData();
    } catch (stageError) {
      setError(
        stageError instanceof Error
          ? stageError.message
          : "Could not update hackathon stage"
      );
    } finally {
      setSaving(false);
    }
  };

  const loadRegistrations = async (hackathonId: string) => {
    setError("");
    try {
      const { registrations } = await apiRequest<{
        registrations: Registration[];
      }>(`/hackathons/${hackathonId}/registrations`);
      setRegistrationsByHackathon((current) => ({
        ...current,
        [hackathonId]: registrations,
      }));
      setRegistrationStatuses((current) => ({
        ...current,
        ...Object.fromEntries(
          registrations.map((registration) => [
            registration._id,
            registration.status,
          ])
        ),
      }));
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "Could not load registrations"
      );
    }
  };

  const updateRegistration = async (hackathonId: string, registrationId: string) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(
        `/hackathons/${hackathonId}/registrations/${registrationId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: registrationStatuses[registrationId],
          }),
        }
      );
      setNotice("Registration status updated.");
      await loadRegistrations(hackathonId);
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "Could not update registration"
      );
    } finally {
      setSaving(false);
    }
  };

  const saveResults = async (hackathon: Hackathon, published: boolean) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/hackathons/${hackathon._id}/results`, {
        method: "PATCH",
        body: JSON.stringify({
          results: parseResults(resultDrafts[hackathon._id] || ""),
          published,
        }),
      });
      setNotice(published ? "Results published." : "Results saved as a draft.");
      await loadData();
    } catch (resultError) {
      setError(
        resultError instanceof Error
          ? resultError.message
          : "Could not save hackathon results"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Organization Management - HackHub</title>
      </Head>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-display-md font-display text-gradient-primary text-glow">
            Organization Management
          </h1>
          <p className="mt-2 text-body-sm font-body text-zinc-400">
            Manage your organization profile, hackathons, registrations, stages,
            and results.
          </p>
        </header>

        {(error || notice) && (
          <div
            className={`card ${
              error ? "border border-red-500/40 text-red-200" : "text-emerald-200"
            }`}
            role={error ? "alert" : "status"}
          >
            {error || notice}
          </div>
        )}

        {loading ? (
          <div className="card text-zinc-400">Loading organization...</div>
        ) : !profile && accountRole !== "organizer" && accountRole !== "admin" ? (
          <div className="card">
            <h2 className="text-heading-lg font-heading mb-2">
              Organizer account required
            </h2>
            <p className="text-body-sm text-zinc-400">
              Organization management is only available to organizer accounts.
              Sign out and create an organization organizer account to continue.
            </p>
          </div>
        ) : (
          <>
            <section className="card">
              <h2 className="text-heading-lg font-heading mb-4">
                {profile ? "Organization Profile" : "Create Organization Profile"}
              </h2>
              <form onSubmit={handleOrganizationSubmit} className="space-y-4">
                <div>
                  <label className="label-enhanced" htmlFor="organization-name">
                    Organization name
                  </label>
                  <input
                    id="organization-name"
                    className="input-enhanced mt-1 w-full"
                    value={organizationDraft.name}
                    onChange={(event) =>
                      setOrganizationDraft({
                        ...organizationDraft,
                        name: event.target.value,
                      })
                    }
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label
                    className="label-enhanced"
                    htmlFor="organization-description"
                  >
                    Description
                  </label>
                  <textarea
                    id="organization-description"
                    className="input-enhanced mt-1 min-h-24 w-full"
                    value={organizationDraft.description}
                    onChange={(event) =>
                      setOrganizationDraft({
                        ...organizationDraft,
                        description: event.target.value,
                      })
                    }
                    maxLength={2000}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-enhanced" htmlFor="organization-email">
                      Contact email
                    </label>
                    <input
                      id="organization-email"
                      type="email"
                      className="input-enhanced mt-1 w-full"
                      value={organizationDraft.contactEmail}
                      onChange={(event) =>
                        setOrganizationDraft({
                          ...organizationDraft,
                          contactEmail: event.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label-enhanced" htmlFor="organization-website">
                      Website
                    </label>
                    <input
                      id="organization-website"
                      type="url"
                      className="input-enhanced mt-1 w-full"
                      value={organizationDraft.website}
                      onChange={(event) =>
                        setOrganizationDraft({
                          ...organizationDraft,
                          website: event.target.value,
                        })
                      }
                      placeholder="https://example.org"
                    />
                  </div>
                </div>
                <button className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save organization profile"}
                </button>
              </form>
            </section>

            {profile && (
              <>
                <section className="card">
                  <h2 className="text-heading-lg font-heading mb-4">
                    {editingHackathon ? "Edit Hackathon" : "Create Hackathon"}
                  </h2>
                  <form onSubmit={handleHackathonSubmit} className="space-y-4">
                    <div>
                      <label className="label-enhanced" htmlFor="hackathon-title">
                        Hackathon name
                      </label>
                      <input
                        id="hackathon-title"
                        className="input-enhanced mt-1 w-full"
                        value={hackathonDraft.title}
                        onChange={(event) =>
                          setHackathonDraft({
                            ...hackathonDraft,
                            title: event.target.value,
                          })
                        }
                        maxLength={120}
                        required
                      />
                    </div>
                    <div>
                      <label
                        className="label-enhanced"
                        htmlFor="hackathon-description"
                      >
                        Description
                      </label>
                      <textarea
                        id="hackathon-description"
                        className="input-enhanced mt-1 min-h-24 w-full"
                        value={hackathonDraft.description}
                        onChange={(event) =>
                          setHackathonDraft({
                            ...hackathonDraft,
                            description: event.target.value,
                          })
                        }
                        maxLength={5000}
                        required
                      />
                    </div>
                    <div>
                      <label className="label-enhanced" htmlFor="eligibility">
                        Eligibility criteria
                      </label>
                      <textarea
                        id="eligibility"
                        className="input-enhanced mt-1 min-h-20 w-full"
                        value={hackathonDraft.eligibility}
                        onChange={(event) =>
                          setHackathonDraft({
                            ...hackathonDraft,
                            eligibility: event.target.value,
                          })
                        }
                        maxLength={2000}
                        required
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="label-enhanced" htmlFor="registration-deadline">
                          Registration deadline
                        </label>
                        <input
                          id="registration-deadline"
                          type="date"
                          className="input-enhanced mt-1 w-full"
                          value={hackathonDraft.registrationDeadline}
                          onChange={(event) =>
                            setHackathonDraft({
                              ...hackathonDraft,
                              registrationDeadline: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="label-enhanced" htmlFor="start-date">
                          Start date
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          className="input-enhanced mt-1 w-full"
                          value={hackathonDraft.startDate}
                          onChange={(event) =>
                            setHackathonDraft({
                              ...hackathonDraft,
                              startDate: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="label-enhanced" htmlFor="end-date">
                          End date
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          className="input-enhanced mt-1 w-full"
                          value={hackathonDraft.endDate}
                          onChange={(event) =>
                            setHackathonDraft({
                              ...hackathonDraft,
                              endDate: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-enhanced" htmlFor="prizes">
                        Prizes
                      </label>
                      <textarea
                        id="prizes"
                        className="input-enhanced mt-1 min-h-20 w-full"
                        value={hackathonDraft.prizesText}
                        onChange={(event) =>
                          setHackathonDraft({
                            ...hackathonDraft,
                            prizesText: event.target.value,
                          })
                        }
                        placeholder={"1st place | $5,000\n2nd place | $2,500"}
                        required
                      />
                      <p className="mt-1 text-caption text-zinc-500">
                        Enter one prize per line as “place | prize details”.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button className="btn-primary" disabled={saving}>
                        {saving
                          ? "Saving..."
                          : editingHackathon
                          ? "Save hackathon"
                          : "Create draft"}
                      </button>
                      {editingHackathon && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setEditingHackathon(null);
                            setHackathonDraft(emptyHackathonDraft);
                          }}
                        >
                          Cancel edit
                        </button>
                      )}
                    </div>
                  </form>
                </section>

                <section>
                  <h2 className="text-heading-lg font-heading mb-4">
                    Your Hackathons
                  </h2>
                  {hackathons.length === 0 ? (
                    <div className="card text-zinc-400">
                      No hackathons created yet.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {hackathons.map((hackathon) => (
                        <article key={hackathon._id} className="card space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <h3 className="text-heading-lg font-heading">
                                {hackathon.title}
                              </h3>
                              <p className="mt-1 text-sm text-zinc-400">
                                {hackathon.published ? "Published" : "Draft"} ·{" "}
                                Registration closes{" "}
                                {new Date(
                                  hackathon.registrationDeadline
                                ).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              className="btn-secondary"
                              onClick={() => editHackathon(hackathon)}
                            >
                              Edit details
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-body-sm text-zinc-300">
                            {hackathon.description}
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="font-semibold">Eligibility</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">
                                {hackathon.eligibility}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold">Prizes</p>
                              <ul className="mt-1 space-y-1 text-sm text-zinc-400">
                                {hackathon.prizes.map((prize) => (
                                  <li key={`${prize.place}-${prize.description}`}>
                                    {prize.place}: {prize.description}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          {!hackathon.published && (
                            <button
                              className="btn-primary"
                              disabled={saving}
                              onClick={() => publishHackathon(hackathon._id)}
                            >
                              Publish hackathon
                            </button>
                          )}

                          <div className="grid gap-3 border-t border-slate-600/60 pt-4 sm:grid-cols-[1fr_auto]">
                            <div>
                              <label
                                className="label-enhanced"
                                htmlFor={`stage-${hackathon._id}`}
                              >
                                Hackathon stage
                              </label>
                              <select
                                id={`stage-${hackathon._id}`}
                                className="input-enhanced mt-1 w-full"
                                value={stageDrafts[hackathon._id] || hackathon.stage}
                                onChange={(event) =>
                                  setStageDrafts((stages) => ({
                                    ...stages,
                                    [hackathon._id]: event.target
                                      .value as Hackathon["stage"],
                                  }))
                                }
                              >
                                <option value="registration">Registration</option>
                                <option value="judging">Judging</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                            <button
                              className="btn-secondary self-end"
                              disabled={saving}
                              onClick={() => updateStage(hackathon._id)}
                            >
                              Update stage
                            </button>
                          </div>

                          <div className="border-t border-slate-600/60 pt-4">
                            <button
                              className="btn-secondary"
                              onClick={() => loadRegistrations(hackathon._id)}
                            >
                              View registrations and teams
                            </button>
                            {registrationsByHackathon[hackathon._id] && (
                              <div className="mt-4 space-y-3">
                                {registrationsByHackathon[hackathon._id].length ===
                                0 ? (
                                  <p className="text-sm text-zinc-400">
                                    No registrations have been recorded.
                                  </p>
                                ) : (
                                  registrationsByHackathon[hackathon._id].map(
                                    (registration) => (
                                      <div
                                        key={registration._id}
                                        className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
                                      >
                                        <div>
                                          <p className="font-semibold">
                                            {registration.team?.name ||
                                              registration.teamName ||
                                              registration.student?.name ||
                                              "Individual registration"}
                                          </p>
                                          <p className="text-sm text-zinc-400">
                                            {registration.student?.email ||
                                              registration.projectName ||
                                              registration.student?.name ||
                                              "Team registration"}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <select
                                            className="input-enhanced"
                                            aria-label={`Registration status for ${
                                              registration.teamName ||
                                              registration.student?.name ||
                                              "participant"
                                            }`}
                                            value={
                                              registrationStatuses[
                                                registration._id
                                              ] || registration.status
                                            }
                                            onChange={(event) =>
                                              setRegistrationStatuses(
                                                (statuses) => ({
                                                  ...statuses,
                                                  [registration._id]: event
                                                    .target
                                                    .value as Registration["status"],
                                                })
                                              )
                                            }
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="rejected">Rejected</option>
                                          </select>
                                          <button
                                            className="btn-secondary"
                                            disabled={saving}
                                            onClick={() =>
                                              updateRegistration(
                                                hackathon._id,
                                                registration._id
                                              )
                                            }
                                          >
                                            Save status
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  )
                                )}
                              </div>
                            )}
                          </div>

                          <div className="border-t border-slate-600/60 pt-4">
                            <label
                              className="label-enhanced"
                              htmlFor={`results-${hackathon._id}`}
                            >
                              Results
                            </label>
                            <textarea
                              id={`results-${hackathon._id}`}
                              className="input-enhanced mt-1 min-h-24 w-full"
                              value={
                                resultDrafts[hackathon._id] ||
                                hackathon.results
                                  .map((result) =>
                                    [
                                      result.place,
                                      result.teamName,
                                      result.projectName,
                                      result.description,
                                    ].join(" | ")
                                  )
                                  .join("\n")
                              }
                              onChange={(event) =>
                                setResultDrafts((results) => ({
                                  ...results,
                                  [hackathon._id]: event.target.value,
                                }))
                              }
                              placeholder={
                                "1st place | Team Nova | Project name | Winner description"
                              }
                            />
                            <p className="mt-1 text-caption text-zinc-500">
                              Enter one result per line: place | team | project
                              | description.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <button
                                className="btn-secondary"
                                disabled={saving}
                                onClick={() => saveResults(hackathon, false)}
                              >
                                Save results draft
                              </button>
                              <button
                                className="btn-primary"
                                disabled={saving}
                                onClick={() => saveResults(hackathon, true)}
                              >
                                {hackathon.resultsPublished
                                  ? "Update published results"
                                  : "Publish results"}
                              </button>
                              {hackathon.resultsPublished && (
                                <span className="text-sm text-emerald-300">
                                  Results are published
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
