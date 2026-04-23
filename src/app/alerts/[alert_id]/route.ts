import { startTimer, timedJson } from "@/lib/api";
import { ensureDatabaseSetup, query } from "@/lib/db";

type AlertRow = {
  id: string;
  status: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ alert_id: string }> },
) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const { alert_id } = await context.params;
    const payload = await request.json();
    const status = payload?.status;

    if (status !== "active" && status !== "inactive") {
      return timedJson(
        startedAt,
        { error: "Status must be either active or inactive." },
        { status: 400 },
      );
    }

    const existing = await query<AlertRow>(
      "SELECT id, status FROM assessment_alert_configs WHERE id = $1 LIMIT 1",
      [alert_id],
    );

    if (!existing.rows[0]) {
      return timedJson(startedAt, { error: "Alert not found." }, { status: 404 });
    }

    await query(
      `
        UPDATE assessment_alert_configs
        SET status = $2
        WHERE id = $1
      `,
      [alert_id, status],
    );

    return timedJson(startedAt, {
      alert_id,
      status,
      updated: true,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to update alert.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ alert_id: string }> },
) {
  const startedAt = startTimer();

  try {
    await ensureDatabaseSetup();
    const { alert_id } = await context.params;

    const existing = await query<AlertRow>(
      "SELECT id, status FROM assessment_alert_configs WHERE id = $1 LIMIT 1",
      [alert_id],
    );

    if (!existing.rows[0]) {
      return timedJson(startedAt, { error: "Alert not found." }, { status: 404 });
    }

    await query("DELETE FROM assessment_alert_configs WHERE id = $1", [alert_id]);

    return timedJson(startedAt, {
      alert_id,
      deleted: true,
    });
  } catch (error) {
    return timedJson(
      startedAt,
      {
        error: error instanceof Error ? error.message : "Unable to delete alert.",
      },
      { status: 500 },
    );
  }
}
