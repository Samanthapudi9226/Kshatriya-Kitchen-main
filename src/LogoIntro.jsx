import {
  useLayoutEffect,
  useRef,
  useState
} from "react";

import "./LogoIntro.css";


export default function LogoIntro() {

  const leftSRef = useRef(null);
  const rightSRef = useRef(null);

  const signatureTargetRef = useRef(null);
  const samanthapudiTargetRef = useRef(null);

  const [flightData, setFlightData] =
    useState(null);


  useLayoutEffect(() => {

    let timer;
    let frameOne;
    let frameTwo;


    const startMerge = () => {

      const leftS =
        leftSRef.current;

      const rightS =
        rightSRef.current;

      const leftTarget =
        signatureTargetRef.current;

      const rightTarget =
        samanthapudiTargetRef.current;


      if (
        !leftS ||
        !rightS ||
        !leftTarget ||
        !rightTarget
      ) {
        return;
      }


      /*
       * Measure CURRENT visible SS
       * using viewport coordinates.
       */

      const leftRect =
        leftS.getBoundingClientRect();

      const rightRect =
        rightS.getBoundingClientRect();


      /*
       * Measure exact final S slots.
       */

      const leftTargetRect =
        leftTarget.getBoundingClientRect();

      const rightTargetRect =
        rightTarget.getBoundingClientRect();


      /*
       * Stop only the individual S animations.
       * Their exact visible screen positions
       * have already been measured.
       */

      leftS
        .getAnimations()
        .forEach((animation) => {
          animation.cancel();
        });


      rightS
        .getAnimations()
        .forEach((animation) => {
          animation.cancel();
        });


      /*
       * Create viewport-level flying letters.
       *
       * They are NOT inside royal-monogram,
       * therefore parent transforms cannot
       * change their landing coordinates.
       */

      setFlightData({

        left: {
          startLeft:
            leftRect.left,

          startTop:
            leftRect.top,

          startWidth:
            leftRect.width,

          startHeight:
            leftRect.height,

          endLeft:
            leftTargetRect.left,

          endTop:
            leftTargetRect.top,

          endWidth:
            leftTargetRect.width,

          endHeight:
            leftTargetRect.height
        },


        right: {
          startLeft:
            rightRect.left,

          startTop:
            rightRect.top,

          startWidth:
            rightRect.width,

          startHeight:
            rightRect.height,

          endLeft:
            rightTargetRect.left,

          endTop:
            rightTargetRect.top,

          endWidth:
            rightTargetRect.width,

          endHeight:
            rightTargetRect.height
        },


        flying: false

      });


      /*
       * Wait until React paints the fixed
       * copies in their exact starting places.
       */

      frameOne =
        requestAnimationFrame(() => {

          /*
           * Hide original SS only AFTER
           * fixed copies exist.
           */

          leftS.style.visibility =
            "hidden";

          rightS.style.visibility =
            "hidden";


          frameTwo =
            requestAnimationFrame(() => {

              /*
               * Now move the SAME visible
               * flying letters to final slots.
               */

              setFlightData((current) => {

                if (!current) {
                  return current;
                }

                return {
                  ...current,
                  flying: true
                };

              });

            });

        });

    };


    /*
     * Keep SS together first.
     * Then begin separation + landing.
     */

    timer =
      setTimeout(
        startMerge,
        3450
      );


    return () => {

      clearTimeout(timer);

      if (frameOne) {
        cancelAnimationFrame(frameOne);
      }

      if (frameTwo) {
        cancelAnimationFrame(frameTwo);
      }

    };

  }, []);


  return (

    <div className="royal-intro">


      {/* =================================================
          FIXED VIEWPORT FLIGHT LAYER
      ================================================= */}


      {flightData && (

        <div className="ss-flight-layer">


          {/* LEFT ORIGINAL S -> Signature */}


          <span
            className={
              flightData.flying
                ? "flying-royal-s flying-royal-s-left is-flying"
                : "flying-royal-s flying-royal-s-left"
            }
            style={{
              left:
                flightData.flying
                  ? `${flightData.left.endLeft}px`
                  : `${flightData.left.startLeft}px`,

              top:
                flightData.flying
                  ? `${flightData.left.endTop}px`
                  : `${flightData.left.startTop}px`,

              width:
                flightData.flying
                  ? `${flightData.left.endWidth}px`
                  : `${flightData.left.startWidth}px`,

              height:
                flightData.flying
                  ? `${flightData.left.endHeight}px`
                  : `${flightData.left.startHeight}px`
            }}
          >
            S
          </span>


          {/* RIGHT ORIGINAL S -> Samanthapudi */}


          <span
            className={
              flightData.flying
                ? "flying-royal-s flying-royal-s-right is-flying"
                : "flying-royal-s flying-royal-s-right"
            }
            style={{
              left:
                flightData.flying
                  ? `${flightData.right.endLeft}px`
                  : `${flightData.right.startLeft}px`,

              top:
                flightData.flying
                  ? `${flightData.right.endTop}px`
                  : `${flightData.right.startTop}px`,

              width:
                flightData.flying
                  ? `${flightData.right.endWidth}px`
                  : `${flightData.right.startWidth}px`,

              height:
                flightData.flying
                  ? `${flightData.right.endHeight}px`
                  : `${flightData.right.startHeight}px`
            }}
          >
            S
          </span>


        </div>

      )}


      {/* =================================================
          BACKGROUND
      ================================================= */}


      <div
        className="
          royal-bg-glow
          royal-bg-glow-one
        "
      />


      <div
        className="
          royal-bg-glow
          royal-bg-glow-two
        "
      />


      <div className="royal-vignette" />

      <div className="royal-texture" />


      {/* =================================================
          FLOATING PARTICLES
      ================================================= */}


      <div className="royal-particles">

        <i className="particle p1" />

        <i className="particle p2" />

        <i className="particle p3" />

        <i className="particle p4" />

        <i className="particle p5" />

        <i className="particle p6" />

      </div>


      {/* =================================================
          LEFT CHICKEN LINE ART
      ================================================= */}


      <div className="food-art food-art-left">

        <svg
          viewBox="0 0 150 150"
          aria-hidden="true"
        >

          <path
            d="
              M48 86
              C35 77 32 59 41 47
              C51 34 70 34 82 45
              C91 53 94 65 91 76
              C88 86 80 94 70 98
              C61 102 53 96 48 86Z
            "
          />


          <path
            d="
              M82 46
              C92 37 101 30 108 25
              C112 22 118 24 120 28
              C122 32 120 36 116 39
              L101 51
            "
          />


          <path
            d="
              M110 27
              C108 20 111 15 116 14
              C121 13 124 17 123 22
            "
          />


          <path
            d="
              M116 30
              C122 27 127 29 128 34
              C129 39 125 42 120 41
            "
          />


          <path
            d="
              M49 58
              C59 51 72 51 82 58
            "
          />


          <path
            d="
              M46 69
              C58 62 74 62 87 69
            "
          />


          <path
            d="
              M49 80
              C59 75 71 75 82 79
            "
          />

        </svg>

      </div>


      {/* =================================================
          RIGHT SPICES LINE ART
      ================================================= */}


      <div className="food-art food-art-right">

        <svg
          viewBox="0 0 150 150"
          aria-hidden="true"
        >

          {/* STAR ANISE */}

          <path
            d="
              M77 34
              L83 50
              L100 44
              L92 59
              L107 68
              L90 71
              L92 89
              L79 77
              L67 90
              L68 72
              L50 69
              L65 59
              L57 44
              L74 50
              Z
            "
          />


          <circle
            cx="79"
            cy="61"
            r="5"
          />


          {/* CARDAMOM */}

          <path
            d="
              M45 100
              C50 88 61 84 70 89
              C73 101 67 112 56 116
              C48 114 43 108 45 100Z
            "
          />


          <path
            d="
              M49 109
              L66 92
            "
          />


          {/* CLOVE */}

          <path
            d="
              M91 101
              L105 119
            "
          />


          <path
            d="
              M88 99
              C85 94 88 89 93 90
              C98 90 100 95 97 99
              C95 102 91 102 88 99Z
            "
          />

        </svg>

      </div>


      {/* =================================================
          MAIN STAGE
      ================================================= */}


      <div className="royal-stage">


        {/* STEAM */}


        <div className="steam-stage">

          <span
            className="
              steam
              steam-one
            "
          />

          <span
            className="
              steam
              steam-two
            "
          />

          <span
            className="
              steam
              steam-three
            "
          />

        </div>


        {/* =================================================
            DUM HANDI
        ================================================= */}


        <div className="handi-art">

          <svg
            viewBox="0 0 220 120"
            aria-hidden="true"
          >

            <path
              d="
                M53 45
                C63 93 79 103 110 103
                C141 103 157 93 167 45
              "
            />


            <path
              d="
                M43 45
                H177
              "
            />


            <path
              d="
                M61 37
                C76 29 144 29 159 37
              "
            />


            <path
              d="
                M83 28
                C92 20 128 20 137 28
              "
            />


            <path
              d="
                M43 53
                C30 53 25 47 24 41
              "
            />


            <path
              d="
                M177 53
                C190 53 195 47 196 41
              "
            />


            <path
              d="
                M74 92
                C95 98 125 98 146 92
              "
            />

          </svg>

        </div>


        {/* =================================================
            ORIGINAL INTERLOCKED SS
        ================================================= */}


        <div className="royal-monogram">


          <span
            ref={leftSRef}
            className="
              royal-s
              royal-s-left
            "
          >
            S
          </span>


          <span
            ref={rightSRef}
            className="
              royal-s
              royal-s-right
            "
          >
            S
          </span>


          <span className="monogram-shine" />


        </div>


        {/* =================================================
            FINAL IDENTITY
        ================================================= */}


        <div className="royal-final">


          {/* WORDMARK */}


          <div className="royal-wordmark">


            <span className="word-kshatriya">
              Kshatriya
            </span>


            <span className="word-brand-s">
              S
            </span>


            <span className="word-kitchen">
              Kitchen
            </span>


          </div>


          {/* DIVIDER */}


          <div className="royal-divider">

            <span />

            <i />

            <span />

          </div>


          {/* =================================================
              TAGLINE

              IMPORTANT:
              These two S elements are invisible
              measurement placeholders.

              The visible S letters are the SAME
              flying SS above.
          ================================================= */}


          <div className="royal-tagline">


            {/* SIGNATURE */}


            <span className="signature-word">


              <b
                ref={signatureTargetRef}
                className="
                  signature-s
                  real-target-s
                "
                aria-hidden="true"
              >
                S
              </b>


              <span className="signature-rest">
                ignature
              </span>


            </span>


            {/* OF */}


            <em>
              of
            </em>


            {/* SAMANTHAPUDI */}


            <span className="signature-word">


              <b
                ref={samanthapudiTargetRef}
                className="
                  signature-s
                  real-target-s
                "
                aria-hidden="true"
              >
                S
              </b>


              <span className="signature-rest">
                amanthapudi
              </span>


            </span>


          </div>


          {/* SUBTITLE */}


          <div className="royal-subtitle">
            AUTHENTIC • DUM • SIGNATURE
          </div>


        </div>

      </div>

    </div>

  );

}