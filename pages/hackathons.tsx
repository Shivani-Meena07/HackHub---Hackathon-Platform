import { useEffect, useState } from "react";
import Head from "next/head";
import Layout from "../components/Layout";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface Prize {
  place: string;
  description: string;
}

interface Result {
  place: string;
  teamName: string;
  projectName: string;
  description: string;
}

interface PublishedHackathon {
  _id: string;
  title: string;
  description: string;
  eligibility: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  prizes: Prize[];
  stage: "registration" | "judging" | "completed";
  results: Result[];
  resultsPublished: boolean;
  organization: { name: string; website: string };
}

export default function HackathonsPage() {
  const [hackathons, setHackathons] = useState<PublishedHackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/hackathons/published`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Could not load hackathons");
        }
        setHackathons(result.hackathons);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load published hackathons"
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <Head>
        <title>Published Hackathons - HackHub</title>
      </Head>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-display-md font-display text-gradient-primary text-glow">
            Published Hackathons
          </h1>
          <p className="mt-2 text-body-sm font-body text-zinc-400">
            Explore hackathons published by organizations.
          </p>
        </header>

        {error && (
          <div className="card border border-red-500/40 text-red-200" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="card text-zinc-400">Loading hackathons...</div>
        ) : !error && hackathons.length === 0 ? (
          <div className="card text-zinc-400">
            No hackathons have been published yet.
          </div>
        ) : (
          <div className="space-y-5">
            {hackathons.map((hackathon) => (
              <article className="card space-y-4" key={hackathon._id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-heading-lg font-heading">
                      {hackathon.title}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      Hosted by {hackathon.organization?.name || "Organization"}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-sm capitalize text-cyan-200">
                    {hackathon.stage}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-body-sm text-zinc-300">
                  {hackathon.description}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">Eligibility</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">
                      {hackathon.eligibility}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">Dates</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      Registration deadline:{" "}
                      {new Date(
                        hackathon.registrationDeadline
                      ).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {new Date(hackathon.startDate).toLocaleDateString()} –{" "}
                      {new Date(hackathon.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Prizes</h3>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-400">
                    {hackathon.prizes.map((prize) => (
                      <li key={`${prize.place}-${prize.description}`}>
                        {prize.place}: {prize.description}
                      </li>
                    ))}
                  </ul>
                </div>
                {hackathon.resultsPublished && hackathon.results.length > 0 && (
                  <div className="border-t border-slate-600/60 pt-4">
                    <h3 className="font-semibold">Results</h3>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                      {hackathon.results.map((result) => (
                        <li key={`${result.place}-${result.teamName}`}>
                          <span className="font-semibold">
                            {result.place}: {result.teamName}
                          </span>
                          {result.projectName && ` · ${result.projectName}`}
                          {result.description && ` — ${result.description}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
