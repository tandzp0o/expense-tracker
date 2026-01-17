import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
    Title,
} from "chart.js";

let isRegistered = false;

export const ensureChartJsRegistered = () => {
    if (isRegistered) return;

    ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        BarElement,
        ArcElement,
        Tooltip,
        Legend,
        Filler,
        Title,
    );

    isRegistered = true;
};
