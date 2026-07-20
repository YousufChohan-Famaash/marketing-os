import { ConnectVideo } from './ConnectVideo';

/**
 * Compact, still-playable thumbnail of the attorney video, sat next to a form's
 * heading on the Call / Text / Schedule / Send views. Keeps the human presence
 * from the home hero in view instead of dropping into a faceless white form
 * (feedback round 1, #1 + 4.6), without repeating the heading copy.
 */
export function PresenceVideo() {
  return <ConnectVideo compact className="h-[104px] w-[92px] shrink-0 rounded-xl" />;
}
