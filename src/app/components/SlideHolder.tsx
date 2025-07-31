"use client";
import React from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css";
import { classNames } from "../lib/classNames";

type SlideItem = {
  title: string;
  stat: string | undefined;
  width?: string;
  fullWidth?: boolean;   // Wenn true: col-span-2 (volle Breite)
  textSize?: string;     // z.B. "text-sm", "text-xl" etc.
};

type Props = {
  slides: SlideItem[];
  splideRef: any;
};

const options = {
  type: "loop",
  arrows: false,
  direction: "ttb",
  height: "100vh",
  autoplay: true,
  interval: 10000,
  speed: 1000,
  pagination: false,
};

const SlideHolder = ({ slides, splideRef }: Props) => {
  return (
    <Splide options={options} ref={splideRef}>
      <SplideSlide>
        <div className="h-full w-full text-white grid grid-cols-2 gap-4 p-4">
          {slides.map((item, index) => (
            <div
              key={index}
              className={classNames(
                item.fullWidth ? "col-span-2" : "",
                item.width ? item.width : "",
                "flex flex-col items-center justify-center"
              )}
            >
              <span className={classNames("font-semibold", item.textSize ? item.textSize : "text-6xl")}>
                {item.stat}
              </span>
              <div className={classNames("mt-4 text-sm")}>  {/* Hier immer kleiner */}
                {item.title}
              </div>
            </div>
          ))}
        </div>
      </SplideSlide>
    </Splide>
  );
};

export default SlideHolder;
