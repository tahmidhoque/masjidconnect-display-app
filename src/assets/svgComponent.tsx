import * as React from "react";

interface SvgProps {
  width?: string;
  height?: string;
  fill?: string;
  [key: string]: any; // for any additional props
}

const SVGComponent = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="tesselation"
    viewBox="-0.005 -0.005 800 800"
    {...props}
  >
    <defs>
      <pattern
        id="pattern"
        viewBox="-0.005 -0.005 800 800"
        height="20%"
        width="20%"
      >
        <path
          d="M300,300L359.175,300L400,258.579L440.825,300L500,300L500,359.175L541.421,400L500,440.825L500,500L440.825,500L400,541.421L359.175,500L300,500L300,440.825L258.579,400L300,359.175L300,300"
          fill="none"
          className="sun"
          name="sun"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-0"
          name="dart-0"
          transform="rotate(0)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-1"
          name="dart-1"
          transform="rotate(45)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-2"
          name="dart-2"
          transform="rotate(90)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-3"
          name="dart-3"
          transform="rotate(135)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-4"
          name="dart-4"
          transform="rotate(180)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-5"
          name="dart-5"
          transform="rotate(225)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-6"
          name="dart-6"
          transform="rotate(270)"
          transform-origin="400 400"
        />
        <path
          d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
          fill="none"
          className="dart-7"
          name="dart-7"
          transform="rotate(315)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-0"
          name="petal-0"
          transform="rotate(0)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-1"
          name="petal-1"
          transform="rotate(45)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-2"
          name="petal-2"
          transform="rotate(90)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-3"
          name="petal-3"
          transform="rotate(135)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-4"
          name="petal-4"
          transform="rotate(180)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-5"
          name="petal-5"
          transform="rotate(225)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-6"
          name="petal-6"
          transform="rotate(270)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
          fill="none"
          className="petal-7"
          name="petal-7"
          transform="rotate(315)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(0) scale(-1,1)"
          transform-origin="400 400"
          className="star-0"
          name="star-0"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(0)"
          transform-origin="400 400"
          className="star0-flipped"
          name="star0-flipped"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(90)"
          transform-origin="400 400"
          className="star-1"
          name="star-1"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(90) scale(-1, 1)"
          transform-origin="400 400"
          className="star1-flipped"
          name="star1-flipped"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(180) scale(-1,1)"
          transform-origin="400 400"
          className="star-2"
          name="star-2"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(180)"
          transform-origin="400 400"
          className="star2-flipped"
          name="star2-flipped"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(270)"
          transform-origin="400 400"
          className="star-3"
          name="star-3"
        />
        <path
          d="M117.157,117.157L165.685,0L400,0L300,40.825L300,158.579L217.157,75.736L117.157,117.157"
          fill="none"
          transform="rotate(270) scale(-1, 1)"
          transform-origin="400 400"
          className="star3-flipped"
          name="star3-flipped"
        />
        <path
          d="M117.157,117.157L0,165.685L0,0L165.685,0L117.157,117.157"
          fill="none"
          className="octagon-0"
          name="octagon-0"
          transform="rotate(0)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L0,165.685L0,0L165.685,0L117.157,117.157"
          fill="none"
          className="octagon-1"
          name="octagon-1"
          transform="rotate(90)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L0,165.685L0,0L165.685,0L117.157,117.157"
          fill="none"
          className="octagon-2"
          name="octagon-2"
          transform="rotate(180)"
          transform-origin="400 400"
        />
        <path
          d="M117.157,117.157L0,165.685L0,0L165.685,0L117.157,117.157"
          fill="none"
          className="octagon-3"
          name="octagon-3"
          transform="rotate(270)"
          transform-origin="400 400"
        />
        <g id="quarter">
          <path
            d="M0,165.685L217.157,75.736L400,258.579L359.175,300L40.825,300L0,400"
            stroke="#e6c464"
            strokeWidth={23}
            strokeLinecap="square"
            fill="none"
          />
          <path
            d="M165.685,0L75.736,217.157L258.579,400L300,359.175L300,40.825L400,0"
            stroke="#e6c464"
            strokeWidth={23}
            strokeLinecap="square"
            fill="none"
          />
        </g>
        <use href="#quarter" transform="rotate(0)" transform-origin="400 400" />
        <use
          href="#quarter"
          transform="rotate(90)"
          transform-origin="400 400"
        />
        <use
          href="#quarter"
          transform="rotate(180)"
          transform-origin="400 400"
        />
        <use
          href="#quarter"
          transform="rotate(270)"
          transform-origin="400 400"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#pattern)" stroke="none" />
  </svg>
);
export default SVGComponent;

export const NoMobilePhoneIcon: React.FC<SvgProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={props.width || "100px"}
      height={props.height || "100px"}
      fill={props.fill || "currentColor"}
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z" />
      <path
        transform="rotate(45, 12, 12)"
        d="M2 12h20"
        stroke="#FF0000"
        strokeWidth="2.5"
      />
      <path
        transform="rotate(-45, 12, 12)"
        d="M2 12h20"
        stroke="#FF0000"
        strokeWidth="2.5"
      />
    </svg>
  );
};

export const PrayerRowsIcon: React.FC<SvgProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={props.width || "100px"}
      height={props.height || "100px"}
      fill={props.fill || "currentColor"}
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" />
      {/* Person 1 */}
      <circle cx="6" cy="8" r="2" />
      <path d="M4 10h4v5h-4z" />
      {/* Person 2 */}
      <circle cx="12" cy="8" r="2" />
      <path d="M10 10h4v5h-4z" />
      {/* Person 3 */}
      <circle cx="18" cy="8" r="2" />
      <path d="M16 10h4v5h-4z" />
      {/* Row line */}
      <path d="M2 18h20" strokeWidth="2" stroke="currentColor" fill="none" />
    </svg>
  );
};
