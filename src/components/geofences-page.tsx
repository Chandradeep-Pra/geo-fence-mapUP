"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import type { DashboardData } from "@/lib/assessment-types";
import {
  EmptyState,
  InputField,
  Panel,
  PrimaryButton,
  SectionHeading,
  SelectField,
  TextAreaField,
  categoryTone,
  formatCategory,
} from "@/components/assessment-ui";

const GeofenceMap = dynamic(() => import("@/components/geofence-map-shell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-[28px] border border-white/10 bg-black/20 text-sm text-white/60">
      Loading operations map...
    </div>
  ),
});

const emptyGeofenceForm = {
  name: "",
  description: "",
  category: "delivery_zone" as const,
  coordinatesText: "12.9716,77.5946\n12.9816,77.5946\n12.9816,77.6046\n12.9716,77.6046\n12.9716,77.5946",
};

export function GeofencesPage({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [geofenceForm, setGeofenceForm] = useState(emptyGeofenceForm);

  async function refreshData() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleGeofenceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch("/geofences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: geofenceForm.name,
          description: geofenceForm.description,
          category: geofenceForm.category,
          coordinates: parseCoordinatesInput(geofenceForm.coordinatesText),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to create geofence");
      }

      toast.success(`Geofence created (${result.time_ns}ns)`);
      setGeofenceForm(emptyGeofenceForm);
      await refreshData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create geofence");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <Panel>
        <SectionHeading title="Create polygon geofence" />
        <form onSubmit={handleGeofenceSubmit} className="mt-6 grid gap-4">
          <InputField
            label="Name"
            value={geofenceForm.name}
            onChange={(value) => setGeofenceForm((current) => ({ ...current, name: value }))}
            placeholder="Downtown Delivery Zone"
          />
          <InputField
            label="Description"
            value={geofenceForm.description}
            onChange={(value) => setGeofenceForm((current) => ({ ...current, description: value }))}
            placeholder="Main polygon around central operations"
          />
          <SelectField
            label="Category"
            value={geofenceForm.category}
            onChange={(value) =>
              setGeofenceForm((current) => ({
                ...current,
                category: value as typeof emptyGeofenceForm.category,
              }))
            }
            options={[
              { label: "Delivery zone", value: "delivery_zone" },
              { label: "Restricted zone", value: "restricted_zone" },
              { label: "Toll zone", value: "toll_zone" },
              { label: "Customer area", value: "customer_area" },
            ]}
          />
          <TextAreaField
            label="Coordinates"
            value={geofenceForm.coordinatesText}
            onChange={(value) => setGeofenceForm((current) => ({ ...current, coordinatesText: value }))}
            placeholder="12.9716,77.5946&#10;12.9816,77.5946&#10;12.9816,77.6046&#10;12.9716,77.6046&#10;12.9716,77.5946"
          />
          <PrimaryButton disabled={isPending} className="mt-2 w-full">
            Create geofence
          </PrimaryButton>
        </form>
      </Panel>

      <div className="grid gap-6">
        <Panel className="overflow-hidden bg-[#081109] p-3">
          <GeofenceMap geofences={initialData.geofences} vehicles={initialData.vehicles} />
        </Panel>

        <Panel className="bg-[#09110a]">
          <SectionHeading title="All geofences" />
          <div className="mt-5 space-y-3">
            {initialData.geofences.length === 0 ? (
              <EmptyState
                title="No geofences yet"
                description="Create a polygon zone to begin location and alert testing."
              />
            ) : (
              initialData.geofences.map((geofence) => (
                <div key={geofence.id} className="rounded-3xl border border-white/8 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-medium text-white">{geofence.name}</p>
                      <p className="mt-1 text-sm text-white/60">
                        {geofence.description || "Assessment polygon geofence."}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${categoryTone(geofence.category)}`}>
                      {formatCategory(geofence.category)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/50">
                    {geofence.coordinates.length} polygon points · created{" "}
                    {new Date(geofence.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function parseCoordinatesInput(raw: string) {
  const coordinates = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [latitude, longitude] = line.split(",").map((value) => Number(value.trim()));

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Coordinates must be entered as latitude,longitude pairs.");
      }

      return [latitude, longitude] as [number, number];
    });

  if (coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push(first);
    }
  }

  return coordinates;
}
