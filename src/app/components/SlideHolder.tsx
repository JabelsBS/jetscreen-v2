"use client";
import React from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css";
import { classNames } from "../lib/classNames";
import { motion } from "framer-motion";

type SlideItem = {
  title: string;
  stat: string | undefined;
  width?: string;
  fullWidth?: boolean;
  textSize?: string;
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
            <motion.div
              key={index}
              className={classNames(
                item.fullWidth ? "col-span-2" : "",
                item.width ? item.width : "",
                "flex flex-col items-center justify-center"
              )}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <span className={classNames("font-semibold text-center break-words max-w-full", item.textSize ? item.textSize : "text-6xl")}>
                {item.stat}
              </span>
              <div className="mt-4 text-sm">
                {item.title}
              </div>
            </motion.div>
          ))}
        </div>
      </SplideSlide>
    </Splide>
  );
};

export default SlideHolder;
