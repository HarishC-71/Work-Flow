// Java Code Workflow Visualizer
// Try running this code to see step-by-step execution!
import java.util.Scanner;
public class Main {
    public static void main(String[] args){
        Scanner sc=new Scanner(System.in);
        int n=sc.nextInt();
        if(n==0)System.out.print("0");
        if(n==1)System.out.print("1");
        int a=0,b=1;
        for(int i=2;i<=n;i++){
            int c=a+b;
            a=b;
            b=c;
            System.out.print(a);
        }
    }
}
