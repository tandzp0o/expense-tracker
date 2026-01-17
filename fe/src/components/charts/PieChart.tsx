import React from "react";
import { Pie } from "react-chartjs-2";
import { ensureChartJsRegistered } from "./chartRegistry";
import { pieChartData, pieChartOptions } from "../../theme/chartConfigs";

interface PieChartProps {
    data?: any;
    options?: any;
}

const PieChart: React.FC<PieChartProps> = ({ data, options }) => {
    ensureChartJsRegistered();

    return (
        <div className="full-width" style={{ height: "100%" }}>
            <Pie
                data={data || pieChartData}
                options={options || pieChartOptions}
            />
        </div>
    );
};

export default PieChart;
