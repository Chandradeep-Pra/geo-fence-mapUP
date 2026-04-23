"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import type { DashboardData, GeofenceItem, LiveAlert } from "@/lib/assessment-types";
import {
  EmptyState,
  InputField,
  Panel,
  PrimaryButton,
  SectionHeading,
  SelectField,
} from "@/components/assessment-ui";

const GeofenceMap = dynamic(() => import("@/components/geofence-map-shell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-[28px] border border-white/10 bg-black/20 text-sm text-white/60">
      Loading operations map...
    </div>
  ),
});

const emptyVehicleForm = {
  vehicle_number: "",
  driver_name: "",
  vehicle_type: "truck",
  phone: "",
};

export function VehiclesPage({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialData.vehicles[0]?.id ?? "");
  const [selectedPoint, setSelectedPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [manualLocation, setManualLocation] = useState({
    latitude: "",
    longitude: "",
    timestamp: new Date().toISOString(),
  });
  const [liveVehicleLocation, setLiveVehicleLocation] = useState<{
    latitude: number;
    longitude: number;
    timestamp: string;
  } | null>(initialData.vehicles[0]?.current_location ?? null);
  const [isTracking, setIsTracking] = useState(false);
  const [simulationCaseId, setSimulationCaseId] = useState("case-1");
  const [simulationPoint, setSimulationPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [simulationPath, setSimulationPath] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const trackerRef = useRef<number | null>(null);
  const simulationRunIdRef = useRef(0);
  const configuredPairsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (trackerRef.current !== null) {
        navigator.geolocation.clearWatch(trackerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource("/ws/alerts");

    eventSource.addEventListener("alert", (event) => {
      const nextAlert = JSON.parse((event as MessageEvent).data) as LiveAlert;
      toast.success(
        `${nextAlert.vehicle.vehicle_number} ${nextAlert.event_type} ${nextAlert.geofence.geofence_name}`,
      );
    });

    return () => {
      eventSource.close();
    };
  }, [router, startTransition]);

  async function refreshData() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function postJson(
    url: string,
    body: unknown,
    successMessage: string,
    options?: { refresh?: boolean },
  ) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Request failed");
    }

    toast.success(`${successMessage} (${result.time_ns}ns)`);
    if (options?.refresh !== false) {
      await refreshData();
    }
    return result;
  }

  async function handleVehicleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const result = await postJson("/vehicles", vehicleForm, "Vehicle registered");
      setVehicleForm(emptyVehicleForm);
      setSelectedVehicleId(result.id);
      setLiveVehicleLocation(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to register vehicle");
    }
  }

  async function submitVehicleLocation(payload: {
    vehicle_id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  }, options?: { refresh?: boolean; successMessage?: string }) {
    try {
      if (payload.vehicle_id === selectedVehicleId) {
        setLiveVehicleLocation({
          latitude: payload.latitude,
          longitude: payload.longitude,
          timestamp: payload.timestamp,
        });
      }

      await postJson(
        "/vehicles/location",
        payload,
        options?.successMessage ?? "Vehicle location updated",
        { refresh: options?.refresh },
      );
      setManualLocation((current) => ({
        ...current,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update location");
    }
  }

  async function ensureSimulationAlerts(vehicleId: string, geofence: GeofenceItem) {
    if (geofence.category === "restricted_zone") {
      return;
    }

    const key = `${vehicleId}:${geofence.id}`;

    if (configuredPairsRef.current.has(key)) {
      return;
    }

    const response = await fetch("/alerts/configure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        geofence_id: geofence.id,
        vehicle_id: vehicleId,
        event_type: "both",
      }),
    });

    if (response.ok) {
      configuredPairsRef.current.add(key);
      return;
    }

    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? "Unable to prepare alerts for simulation");
  }

  async function handleManualLocationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedVehicleId) {
      toast.error("Select a vehicle first.");
      return;
    }

    await submitVehicleLocation({
      vehicle_id: selectedVehicleId,
      latitude: Number(manualLocation.latitude),
      longitude: Number(manualLocation.longitude),
      timestamp: manualLocation.timestamp,
    }, { refresh: true });
  }

  function startTracking() {
    if (!selectedVehicleId) {
      toast.error("Register or select a vehicle before starting live tracking.");
      return;
    }

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }

    trackerRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void submitVehicleLocation({
          vehicle_id: selectedVehicleId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        });
      },
      (error) => {
        toast.error(error.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    setIsTracking(true);
    toast.success("Live vehicle tracking started");
  }

  function stopTracking() {
    if (trackerRef.current !== null) {
      navigator.geolocation.clearWatch(trackerRef.current);
      trackerRef.current = null;
    }

    setIsTracking(false);
    toast("Live tracking stopped");
  }

  function applySelectedPoint(point: { latitude: number; longitude: number }) {
    setSelectedPoint(point);
    setManualLocation((current) => ({
      ...current,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
    }));
  }

  function handleVehicleSelection(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    const selectedVehicle =
      initialData.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
    setLiveVehicleLocation(selectedVehicle?.current_location ?? null);
  }

  async function simulateBoundaryCrossing(inside: boolean) {
    if (!selectedVehicleId) {
      toast.error("Select a vehicle first.");
      return;
    }

    const firstGeofence = initialData.geofences[0];

    if (!firstGeofence) {
      toast.error("Create a geofence first.");
      return;
    }

    const target = inside
      ? firstGeofence.coordinates[0]
      : (() => {
          const point = buildOutsidePoint(firstGeofence.coordinates);
          return [point.latitude, point.longitude] as [number, number];
        })();

    await submitVehicleLocation({
      vehicle_id: selectedVehicleId,
      latitude: target[0],
      longitude: target[1],
      timestamp: new Date().toISOString(),
    }, { refresh: true });
  }

  async function runSimulationCase() {
    if (!selectedVehicleId) {
      toast.error("Select a vehicle first.");
      return;
    }

    const geofence = initialData.geofences[0];

    if (!geofence) {
      toast.error("Create a geofence first.");
      return;
    }

    const testCases = buildSimulationCases(geofence);
    const activeCase = testCases.find((item) => item.id === simulationCaseId) ?? testCases[0];

    if (!activeCase) {
      toast.error("No simulation case available.");
      return;
    }

    const runId = Date.now();
    simulationRunIdRef.current = runId;
    setIsSimulating(true);
    setSimulationPath(activeCase.points);
    setSimulationPoint(activeCase.points[0] ?? null);

    try {
      await ensureSimulationAlerts(selectedVehicleId, geofence);

      for (const point of activeCase.points) {
        if (simulationRunIdRef.current !== runId) {
          return;
        }

        setSimulationPoint(point);
        setSelectedPoint(point);
        setManualLocation({
          latitude: String(point.latitude),
          longitude: String(point.longitude),
          timestamp: new Date().toISOString(),
        });

        await submitVehicleLocation({
          vehicle_id: selectedVehicleId,
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: new Date().toISOString(),
        }, {
          refresh: false,
          successMessage: `${activeCase.label} step sent`,
        });

        await delay(900);
      }

      await refreshData();
      toast.success(`${activeCase.label} finished`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Simulation failed");
    } finally {
      if (simulationRunIdRef.current === runId) {
        setIsSimulating(false);
      }
    }
  }

  function stopSimulation() {
    simulationRunIdRef.current += 1;
    setIsSimulating(false);
    toast("Simulation stopped");
  }

  const simulationCases = initialData.geofences[0]
    ? buildSimulationCases(initialData.geofences[0])
    : [];

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="overflow-hidden bg-[#081109] p-3">
          <GeofenceMap
            geofences={initialData.geofences}
            vehicles={initialData.vehicles}
            selectedVehicleId={selectedVehicleId}
            selectedVehicleLocation={liveVehicleLocation}
            isTracking={isTracking}
            selectedPoint={selectedPoint}
            simulationPoint={simulationPoint}
            simulationPath={simulationPath}
            onMapClick={applySelectedPoint}
          />
        </Panel>

        <Panel className="bg-[#0b130d]">
          <SectionHeading title="Movement tools" />
          <div className="mt-5 space-y-3">
            <PrimaryButton
              type="button"
              onClick={isTracking ? stopTracking : startTracking}
              className={clsx(
                "w-full",
                isTracking ? "bg-white/10 text-white hover:bg-white/15" : "",
              )}
            >
              {isTracking ? "Stop live GPS tracking" : "Start live GPS tracking"}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => void simulateBoundaryCrossing(true)}
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Simulate entry into first geofence
            </button>
            <button
              type="button"
              onClick={() => void simulateBoundaryCrossing(false)}
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Simulate exit from first geofence
            </button>
          </div>
          <div className="mt-6 rounded-3xl border border-white/8 bg-black/20 p-5">
            <p className="text-sm text-white/55">Operator notes</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/72">
              <li>Click on the map to prefill latitude and longitude.</li>
              <li>Use simulation buttons for quick boundary checks.</li>
              <li>Choose a vehicle before starting GPS tracking.</li>
            </ul>
          </div>
        </Panel>
      </section>

      <Panel className="bg-[#09110a]">
        <SectionHeading title="Simulation cases" />
        {simulationCases.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="No simulation route yet"
              description="Create at least one geofence to unlock guided movement tests."
            />
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-3">
              {simulationCases.map((testCase) => {
                const isActive = testCase.id === simulationCaseId;

                return (
                  <button
                    key={testCase.id}
                    type="button"
                    onClick={() => {
                      setSimulationCaseId(testCase.id);
                      setSimulationPath(testCase.points);
                      setSimulationPoint(testCase.points[0] ?? null);
                    }}
                    className={clsx(
                      "rounded-full px-4 py-2 text-sm transition",
                      isActive
                        ? "bg-[#a6ff85] font-semibold text-[#061108]"
                        : "border border-white/10 bg-black/20 text-white/72 hover:bg-white/10",
                    )}
                  >
                    {testCase.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[0.7fr_0.3fr]">
              <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <p className="text-lg font-medium text-white">
                  {simulationCases.find((item) => item.id === simulationCaseId)?.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  {simulationCases.find((item) => item.id === simulationCaseId)?.description}
                </p>
                <div className="mt-4 space-y-2 text-sm text-white/68">
                  {simulationCases
                    .find((item) => item.id === simulationCaseId)
                    ?.steps.map((step) => (
                      <p key={step}>{step}</p>
                    ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">Run</p>
                <div className="mt-4 grid gap-3">
                  <PrimaryButton
                    type="button"
                    onClick={() => void runSimulationCase()}
                    disabled={isSimulating}
                    className="w-full"
                  >
                    {isSimulating ? "Simulation running..." : "Run selected case"}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={stopSimulation}
                    className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Stop simulation
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/58">
                  The selected vehicle marker moves live on the map and each step posts a real
                  location update to the backend.
                </p>
              </div>
            </div>
          </>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <SectionHeading title="Register vehicle" />
          <form onSubmit={handleVehicleSubmit} className="mt-6 grid gap-4">
            <InputField
              label="Vehicle number"
              value={vehicleForm.vehicle_number}
              onChange={(value) => setVehicleForm((current) => ({ ...current, vehicle_number: value }))}
              placeholder="KA-01-AB-1234"
            />
            <InputField
              label="Driver name"
              value={vehicleForm.driver_name}
              onChange={(value) => setVehicleForm((current) => ({ ...current, driver_name: value }))}
              placeholder="John Doe"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Vehicle type"
                value={vehicleForm.vehicle_type}
                onChange={(value) => setVehicleForm((current) => ({ ...current, vehicle_type: value }))}
                placeholder="truck"
              />
              <InputField
                label="Phone"
                value={vehicleForm.phone}
                onChange={(value) => setVehicleForm((current) => ({ ...current, phone: value }))}
                placeholder="+1234567890"
              />
            </div>
            <PrimaryButton disabled={isPending} className="mt-2 w-full">
              Register vehicle
            </PrimaryButton>
          </form>
        </Panel>

        <Panel className="bg-[#09110a]">
          <SectionHeading title="Post vehicle location" />
          <form onSubmit={handleManualLocationSubmit} className="mt-6 grid gap-4">
            <SelectField
              label="Vehicle"
              value={selectedVehicleId}
              onChange={handleVehicleSelection}
              options={initialData.vehicles.map((vehicle) => ({
                label: vehicle.vehicle_number,
                value: vehicle.id,
              }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Latitude"
                value={manualLocation.latitude}
                onChange={(value) => setManualLocation((current) => ({ ...current, latitude: value }))}
                placeholder="12.9716"
              />
              <InputField
                label="Longitude"
                value={manualLocation.longitude}
                onChange={(value) => setManualLocation((current) => ({ ...current, longitude: value }))}
                placeholder="77.5946"
              />
            </div>
            <InputField
              label="Timestamp"
              value={manualLocation.timestamp}
              onChange={(value) => setManualLocation((current) => ({ ...current, timestamp: value }))}
              placeholder={new Date().toISOString()}
            />
            <PrimaryButton disabled={isPending} className="mt-2 w-full">
              Update location
            </PrimaryButton>
          </form>
        </Panel>
      </section>

      <Panel>
        <SectionHeading title="Registered vehicles" />
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {initialData.vehicles.length === 0 ? (
            <EmptyState
              title="No vehicles yet"
              description="Register a vehicle to begin posting live or manual positions."
            />
          ) : (
            initialData.vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={clsx(
                  "rounded-3xl border p-5",
                  vehicle.id === selectedVehicleId
                    ? "border-[#aeff9d30] bg-[#aeff9d12]"
                    : "border-white/8 bg-black/20",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium text-white">{vehicle.vehicle_number}</p>
                    <p className="mt-1 text-sm text-white/60">
                      {vehicle.driver_name} · {vehicle.vehicle_type}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVehicleSelection(vehicle.id)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/6"
                  >
                    Select
                  </button>
                </div>
                <p className="mt-3 text-sm text-white/55">
                  {(vehicle.id === selectedVehicleId ? liveVehicleLocation : vehicle.current_location)
                    ? `Last location ${(vehicle.id === selectedVehicleId ? liveVehicleLocation : vehicle.current_location)!.latitude.toFixed(5)}, ${(vehicle.id === selectedVehicleId ? liveVehicleLocation : vehicle.current_location)!.longitude.toFixed(5)}`
                    : "No location posted yet"}
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function buildOutsidePoint(coordinates: [number, number][]) {
  const unique = coordinates.slice(0, -1);
  const latitude = Math.max(...unique.map(([lat]) => lat)) + 0.01;
  const longitude = Math.max(...unique.map(([, lng]) => lng)) + 0.01;

  return { latitude, longitude };
}

function buildSimulationCases(geofence: GeofenceItem) {
  const unique = geofence.coordinates.slice(0, -1);
  const latitudes = unique.map(([latitude]) => latitude);
  const longitudes = unique.map(([, longitude]) => longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return [
    {
      id: "case-1",
      label: "Test case 1",
      description: "Approach from outside and enter the polygon once. You should see the moving dot cross the boundary and trigger an entry alert.",
      steps: [
        "Step 1: start outside the zone on the lower-left side.",
        "Step 2: move closer to the polygon edge.",
        "Step 3: enter the zone and wait for the toast notification.",
      ],
      points: [
        { latitude: minLat - 0.012, longitude: minLng - 0.012 },
        { latitude: minLat - 0.004, longitude: minLng - 0.004 },
        { latitude: centerLat, longitude: centerLng },
      ],
    },
    {
      id: "case-2",
      label: "Test case 2",
      description: "Enter the polygon and continue through it until the vehicle exits on the other side. This should fire both entry and exit notifications.",
      steps: [
        "Step 1: begin outside the polygon.",
        "Step 2: cross into the center of the zone.",
        "Step 3: continue past the far edge to trigger the exit event.",
      ],
      points: [
        { latitude: minLat - 0.01, longitude: minLng - 0.01 },
        { latitude: centerLat, longitude: centerLng },
        { latitude: maxLat + 0.01, longitude: maxLng + 0.01 },
      ],
    },
    {
      id: "case-3",
      label: "Test case 3",
      description: "Sweep across the upper edge, enter briefly, and then leave. This is handy for showing a shorter boundary-crossing animation.",
      steps: [
        "Step 1: move toward the upper edge from outside.",
        "Step 2: clip through the polygon near the top side.",
        "Step 3: exit quickly to the upper-right side.",
      ],
      points: [
        { latitude: maxLat + 0.008, longitude: minLng + 0.002 },
        { latitude: maxLat - 0.002, longitude: centerLng },
        { latitude: maxLat + 0.008, longitude: maxLng + 0.008 },
      ],
    },
  ];
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
