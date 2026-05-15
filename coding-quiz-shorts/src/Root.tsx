import "./index.css";
import { Composition } from "remotion";
import { QuizShort, QuizProps } from "./QuizShort";

const defaultProps: QuizProps = {
  language: "Python",
  question: "Comment your output:",
  codeLines: [
    'v = ["Rohan", "kartik", "Sohail"]',
    'name = input("Enter your name : ")',
    "v.remove(name)  # kartik",
    "print(v)",
  ],
  options: [
    { label: "A)", text: "Rohan kartik Sohail" },
    { label: "B)", text: "Rohan Sohail" },
    { label: "C)", text: "kartik" },
    { label: "D)", text: "Error" },
  ],
  correctIndex: 1,
  channelName: "@YourChannel",
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CodingQuizShort"
      component={QuizShort}
      durationInFrames={450} // 15 seconds at 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
};
