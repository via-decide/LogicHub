import { isLogicHubEvent, LogicHubEvent } from '../event-core/schema';

type Sink = (event: LogicHubEvent) => Promise<void> | void;

type IngestionPipeline = {
  append: (raw: unknown) => Promise<{ accepted: boolean; reason?: string }>;
};

export function createIngestionPipeline(params: {
  streamAppend: Sink;
  graphFanout: Sink;
  timeSeriesFanout: Sink;
  archiveFanout: Sink;
}): IngestionPipeline {
  async function append(raw: unknown) {
    if (!isLogicHubEvent(raw)) return { accepted: false, reason: 'invalid_schema' };
    const event = raw as LogicHubEvent;
    await params.streamAppend(event);
    await Promise.all([
      params.graphFanout(event),
      params.timeSeriesFanout(event),
      params.archiveFanout(event),
    ]);
    return { accepted: true };
  }

  return { append };
}
